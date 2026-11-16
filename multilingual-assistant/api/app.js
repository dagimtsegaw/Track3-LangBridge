/**
 * Express app. createApp() takes an env object and a fetch implementation so
 * tests never call Gemini or Addis. Keys are read from env and are not logged.
 */

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import swaggerUi from "swagger-ui-express";
import { readConfig, healthBody } from "./lib/config.js";
import { rateLimit } from "./lib/limit.js";
import { cleanSections, topSections, sourcesOf, offlineFrom, safeUrl } from "./lib/retrieve.js";
import { createGemini } from "./lib/gemini.js";
import { createAddis, mockWav } from "./lib/addis.js";
import { fitSms } from "./lib/smsText.js";
import { createStore, newTicketId } from "./lib/tickets.js";
import { loadCourse, loadKnowledge } from "./lib/course.js";
import { COULD_NOT_FIND } from "./lib/gemini.js";
import { greetingReply, isGreeting } from "./lib/social.js";
import { adviceReply, isAdviceQuestion } from "../module/providers/advice.js";
import { createLocal } from "../module/providers/local.js";
import { normalizePhone } from "./lib/phone.js";
import { loadLanguageIndex } from "../module/i18n/registry.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const languageIndex = loadLanguageIndex();
const ADDIS_LANGS = languageIndex.addisLangs;
const TOPICS = new Set(["tutor", "careers", "alerts", "accommodation"]);
const TEXT_LIMIT = 3000;
const TRANSLATE_BATCH = 20;
const CONTENT_MAX = 40;
const CONTENT_TEXT = 8000;

export function createApp(options) {
  const opts = options || {};
  const config = readConfig(opts.env || process.env);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const gemini = createGemini({
    key: config.geminiKey,
    model: config.geminiModel,
    ttsModel: config.geminiTtsModel,
    fetchImpl: fetchImpl,
    timeoutMs: opts.geminiTimeoutMs || 12000,
  });
  const addis = createAddis({
    key: config.addisKey,
    base: config.addisBase,
    fetchImpl: fetchImpl,
    timeoutMs: opts.addisTimeoutMs || 20000,
    voices: languageIndex.addisVoices,
  });
  const local = createLocal({
    base: config.ollamaBase,
    model: config.ollamaModel,
    fetchImpl: fetchImpl,
    timeoutMs: opts.ollamaTimeoutMs || 12000,
  });
  const store = createStore(opts.dataFile || path.join(here, "data", "escalations.json"));
  const course = Array.isArray(opts.sections) ? opts.sections : loadCourse(opts.courseFile);
  const knowledge = Array.isArray(opts.sections) || opts.knowledge === false ? [] : loadKnowledge();
  const hooks = [];
  const translations = new Map();
  let indexed = null;

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(rateLimit({ windowMs: 60 * 1000, max: opts.rateMax || 60 }));
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || config.origins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/v1/health", function (_req, res) {
    res.json(healthBody(config));
  });

  app.post("/api/v1/ask", asyncRoute(async function (req, res) {
    const question = String((req.body && req.body.question) || "").trim();
    if (!question) return res.status(400).json({ error: "Type a question first." });
    if (question.length > 1000) return res.status(400).json({ error: "The question is too long." });
    const language = cleanLang(req.body && req.body.language);
    const provided = req.body && Object.prototype.hasOwnProperty.call(req.body, "sections");
    const sections = provided ? req.body.sections : indexed || course;
    const result = await askOfflineOrModel(question, language, sections, provided || !indexed);
    return res.json(result);
  }));

  app.post("/api/v1/content", function (req, res) {
    const parsed = parseContent(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    indexed = parsed.sections;
    return res.status(201).json({ indexed: indexed.length });
  });

  app.post("/api/v1/tts", asyncRoute(async function (req, res) {
    const text = String((req.body && req.body.text) || "").trim();
    if (!text) return res.status(400).json({ error: "Text is required." });
    if (text.length > TEXT_LIMIT) {
      return res.status(400).json({ error: "Text is longer than 3000 characters." });
    }
    const language = cleanLang(req.body && req.body.language);
    let audio;
    try {
      audio = await speak(text, language);
    } catch (error) {
      const status = error && (error.status === 501 || error.status === 400) ? error.status : 502;
      const message =
        status === 501 || status === 400
          ? error.message
          : "The speech service did not return audio.";
      return res.status(status).json({ error: message });
    }
    res.set("content-type", audio.mime || "application/octet-stream");
    res.set("cache-control", "no-store");
    if (audio.mock) res.set("x-db-tts", "mock");
    return res.status(200).send(audio.bytes);
  }));

  app.post("/api/v1/translate", asyncRoute(async function (req, res) {
    const texts = req.body && req.body.texts;
    const target = cleanLang(req.body && req.body.target);
    if (!Array.isArray(texts) || texts.some(function (item) { return typeof item !== "string"; })) {
      return res.status(400).json({ error: "texts must be a list of strings." });
    }
    if (!target) return res.status(400).json({ error: "A target language is required." });
    if (texts.length < 1 || texts.length > TRANSLATE_BATCH) {
      return res.status(400).json({ error: "Send between 1 and 20 strings." });
    }
    if (texts.some(function (item) { return item.length > 2000; })) {
      return res.status(400).json({ error: "Each string must be 2000 characters or fewer." });
    }
    if (!config.geminiOn) return res.status(503).json({ error: "Translation is not configured." });
    const cacheKey = target + "\n" + JSON.stringify(texts);
    if (translations.has(cacheKey)) {
      const hit = translations.get(cacheKey);
      translations.delete(cacheKey);
      translations.set(cacheKey, hit);
      return res.json({ texts: hit });
    }
    try {
      const translated = await gemini.translate({ texts: texts, target: target });
      if (translations.size >= 200) {
        const oldest = translations.keys().next().value;
        translations.delete(oldest);
      }
      translations.set(cacheKey, translated);
      return res.json({ texts: translated });
    } catch (error) {
      const reason = translateReason(error && error.reason);
      const status = reason === "rate_limit" ? 429 : 502;
      return res.status(status).json({ error: translateError(reason), reason: reason });
    }
  }));

  app.post("/api/v1/escalations", asyncRoute(async function (req, res) {
    const conversation = cleanConversation(req.body && req.body.conversation);
    if (!conversation) return res.status(400).json({ error: "A conversation is required." });
    const topicGiven = !!(req.body && Object.prototype.hasOwnProperty.call(req.body, "topic"));
    const topic = cleanTopic(req.body && req.body.topic, topicGiven);
    if (!topic) return res.status(400).json({ error: "That topic is not available." });
    const rawContact = String((req.body && req.body.contact) || "").trim();
    let contact = "";
    if (rawContact) {
      const phone = normalizePhone(rawContact);
      if (!phone.ok) return res.status(400).json({ error: phone.error });
      contact = phone.phone;
    }
    const ticket = {
      ticketId: newTicketId(),
      language: cleanLang(req.body && req.body.language) || "en",
      contact: contact,
      topic: topic,
      conversation: conversation,
      page: cleanPage(req.body && req.body.page),
      context: cleanContext(req.body && req.body.context),
      status: "waiting",
      note: "",
      createdAt: new Date().toISOString(),
    };
    await store.create(ticket);
    await notify(ticket);
    return res.status(201).json({ ticketId: ticket.ticketId });
  }));

  app.get("/api/v1/escalations", asyncRoute(async function (req, res) {
    if (!allowHelper(req, res, config.helperToken)) return;
    const tickets = await store.waiting();
    return res.json({
      tickets: tickets.map(function (ticket) {
        return {
          ticketId: ticket.ticketId,
          language: ticket.language,
          contact: ticket.contact || "",
          topic: ticket.topic || "tutor",
          conversation: ticket.conversation,
          page: ticket.page || null,
          context: Array.isArray(ticket.context) ? ticket.context : [],
          createdAt: ticket.createdAt,
          status: ticket.status,
        };
      }),
    });
  }));

  app.patch("/api/v1/escalations/:ticketId", asyncRoute(async function (req, res) {
    if (!allowHelper(req, res, config.helperToken)) return;
    const ticketId = String(req.params.ticketId || "");
    if (!/^db-[a-f0-9]+$/.test(ticketId)) {
      return res.status(400).json({ error: "That ticket id is not valid." });
    }
    const note = String((req.body && req.body.note) || "").trim().slice(0, 2000);
    const updated = await store.answer(ticketId, note);
    if (!updated) return res.status(404).json({ error: "That ticket was not found." });
    return res.json({ ticketId: updated.ticketId, status: "answered" });
  }));

  app.post("/api/v1/webhooks", function (req, res) {
    let parsed;
    try {
      parsed = new URL(String((req.body && req.body.url) || ""));
    } catch {
      return res.status(400).json({ error: "A webhook needs an http or https URL." });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return res.status(400).json({ error: "A webhook needs an http or https URL." });
    }
    if (parsed.hostname === "169.254.169.254") {
      return res.status(400).json({ error: "That webhook URL is not allowed." });
    }
    const requested = Array.isArray(req.body && req.body.events) ? req.body.events : ["escalation.opened"];
    const events = requested.filter(function (event) {
      return event === "escalation.opened";
    });
    if (!events.length) return res.status(400).json({ error: "That event is not available." });
    if (hooks.length >= 20) return res.status(400).json({ error: "Too many webhooks are registered." });
    const hook = { id: "wh-" + randomBytes(4).toString("hex"), url: parsed.toString().slice(0, 500), events: events };
    hooks.push(hook);
    return res.status(201).json({ id: hook.id });
  });

  app.post("/sms/inbound", asyncRoute(async function (req, res) {
    const text = String((req.body && req.body.text) || "").trim();
    if (!text) return res.status(400).type("text/plain").send("Text is required.");
    const from = String((req.body && req.body.from) || "").trim();
    if (from) {
      const phone = normalizePhone(from);
      if (!phone.ok) return res.status(400).type("text/plain; charset=utf-8").send(phone.error);
    }
    const question = text.slice(0, 1000);
    const language = smsLanguage(req.body, question);
    if (isAdviceQuestion(question)) {
      return res.status(200).type("text/plain; charset=utf-8").send(adviceReply(language).slice(0, 160));
    }
    // topSections tokenises with none.js normalize, the same scorer the widget uses.
    const asked = await askOfflineOrModel(question, language, indexed || course, !indexed);
    const reply = fitSms({
      text: asked.answer,
      sources: asked.sources,
    });
    return res.status(200).type("text/plain; charset=utf-8").send(reply.slice(0, 160));
  }));

  mountDocs(app, opts.specPath || path.resolve(here, "../openapi.yaml"));
  app.get("/module/calendar.js", function (_req, res) {
    res.type("text/javascript; charset=utf-8");
    res.sendFile(path.resolve(here, "../module/calendar.js"));
  });
  app.get("/helper", function (_req, res) {
    res.sendFile(path.join(here, "public", "helper.html"));
  });

  app.use(function (_req, res) {
    res.status(404).json({ error: "That address is not available." });
  });
  app.use(function (err, req, res, _next) {
    if (res.headersSent) return;
    console.error(req.method + " " + req.path + " failed");
    if (err && err.type === "entity.too.large") {
      return res.status(413).json({ error: "The request is too large." });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: "The request body is not valid JSON." });
    }
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return app;

  async function speak(text, language) {
    if (ADDIS_LANGS.has(language)) {
      if (config.ttsProvider === "mock") {
        return { mime: "audio/wav", bytes: mockWav(), mock: true };
      }
      if (!config.ttsAddis) {
        const error = new Error("Speech for this language is not configured.");
        error.status = 501;
        throw error;
      }
      try {
        return await addis.speak(text, language);
      } catch (error) {
        // 501 means Addis has no voice for this language (Somali today). Gemini is the only other voice.
        if (!error || error.status !== 501 || !config.ttsGemini) throw error;
      }
    }
    if (!config.ttsGemini) {
      const error = new Error("Speech for this language is not configured.");
      error.status = 501;
      throw error;
    }
    return gemini.speak(text);
  }

  async function askOfflineOrModel(question, language, sections, withKnowledge) {
    if (isGreeting(question)) {
      return { answer: greetingReply(language), sources: [], mode: "greeting" };
    }
    if (isAdviceQuestion(question)) {
      return { answer: adviceReply(language), sources: [], mode: "advice" };
    }
    const extra = withKnowledge === false ? [] : cleanSections(knowledge, 80);
    const cleaned = mergeSections(cleanSections(sections, 40), extra);
    const picked = topSections(question, cleaned, language);
    if (!picked.length) {
      return { answer: null, sources: [], mode: "not-found" };
    }
    const sources = sourcesOf(picked);
    const offline = await offlineFrom(question, picked, language);
    const excerpt = offline && offline.text ? offline.text : "";
    if (!config.ai) {
      return { answer: excerpt || null, sources: excerpt ? sources : [], mode: excerpt ? "offline" : "not-found" };
    }
    const answerer = config.aiProvider === "ollama" ? local : gemini;
    const answeredMode = config.aiProvider === "ollama" ? "ollama" : "gemini";
    try {
      const text = await answerer.answer({
        question: question,
        language: language,
        sections: forModel(picked),
      });
      if (!text || couldNotFind(text)) return { answer: null, sources: [], mode: "not-found" };
      return { answer: text, sources: sources, mode: answeredMode };
    } catch {
      if (!excerpt) return { answer: null, sources: [], mode: "not-found" };
      return { answer: excerpt, sources: sources, mode: "offline-fallback" };
    }
  }

  async function notify(ticket) {
    const payload = JSON.stringify({
      event: "escalation.opened",
      ticketId: ticket.ticketId,
      language: ticket.language,
    });
    const jobs = hooks
      .filter(function (hook) {
        return hook.events.includes("escalation.opened");
      })
      .map(function (hook) {
        return fetchImpl(hook.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(4000),
        }).catch(function () {
          return null;
        });
      });
    await Promise.all(jobs);
  }
}

function allowHelper(req, res, token) {
  if (!token) {
    res.status(503).json({ error: "Helper access is not configured." });
    return false;
  }
  const header = String(req.get("x-helper-token") || "");
  const auth = String(req.get("authorization") || "");
  const presented = header || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
  if (!sameSecret(presented, token)) {
    res.status(401).json({ error: "The helper token was not accepted." });
    return false;
  }
  return true;
}

function sameSecret(presented, expected) {
  const left = Buffer.from(String(presented));
  const right = Buffer.from(String(expected));
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

function translateReason(reason) {
  if (reason === "rate_limit" || reason === "bad_key" || reason === "bad_model" || reason === "bad_response") {
    return reason;
  }
  return "bad_response";
}

function translateError(reason) {
  if (reason === "rate_limit") return "The translation service is busy. Try again in a moment.";
  if (reason === "bad_key") return "The translation key was rejected.";
  if (reason === "bad_model") return "The translation model is not available.";
  return "The translation service sent a response that could not be used.";
}

function parseContent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.sections) || !body.sections.length) {
    return { error: "Send a list of sections to index." };
  }
  if (body.sections.length > CONTENT_MAX) return { error: "Send at most 40 sections." };
  const sections = [];
  for (let i = 0; i < body.sections.length; i += 1) {
    const item = body.sections[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each section needs a title or text." };
    }
    const title = String(item.title || "").trim();
    const text = String(item.text || "").trim();
    if (!title && !text) return { error: "Each section needs a title or text." };
    if (title.length > 300 || text.length > CONTENT_TEXT) return { error: "A section is too long." };
    const id = String(item.id || "").trim();
    const url = String(item.url || "").trim();
    const lang = String(item.lang || "").trim().toLowerCase();
    if (id.length > 200 || url.length > 1000 || lang.length > 12) return { error: "A section is too long." };
    sections.push({
      id: id,
      title: title,
      url: safeUrl(url),
      text: text,
      lang: lang,
    });
  }
  return { sections: sections };
}

function cleanTopic(value, provided) {
  if (!provided) return "tutor";
  const topic = String(value || "").trim().toLowerCase();
  return TOPICS.has(topic) ? topic : "";
}

function cleanPage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const url = String(value.url || "").trim().slice(0, 2000);
  const heading = String(value.heading || "").trim().slice(0, 300);
  const selection = String(value.selection || "").trim().slice(0, 2000);
  if (!url && !heading && !selection) return null;
  return { url: url, heading: heading, selection: selection };
}

function cleanContext(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length && out.length < 8; i += 1) {
    const item = value[i];
    const title = String((item && item.title) || "").trim().slice(0, 200);
    const url = String((item && item.url) || "").trim().slice(0, 500);
    const text = String((item && item.text) || "").trim().slice(0, 500);
    if (!title && !text) continue;
    out.push({ title: title, url: url, text: text });
  }
  return out;
}

function smsLanguage(body, text) {
  const given = cleanLang(body && body.language);
  if (given) return given;
  if (/[\u1200-\u137F]/.test(text)) return "am";
  if (/\p{Script=Arabic}/u.test(text)) return "ar";
  return "en";
}

function cleanLang(value) {
  const code = String(value || "").trim().toLowerCase();
  if (!/^[a-z]{2,12}$/.test(code)) return "";
  return code;
}

function cleanConversation(value) {
  if (typeof value === "string") {
    const text = value.trim().slice(0, 2000);
    return text ? [{ role: "learner", text: text }] : null;
  }
  if (!Array.isArray(value) || !value.length) return null;
  const turns = [];
  for (let i = 0; i < value.length && turns.length < 40; i += 1) {
    const turn = value[i];
    const text = String((turn && turn.text) || "").trim().slice(0, 2000);
    if (!text) continue;
    const role = String((turn && turn.role) || "learner").trim().slice(0, 40) || "learner";
    turns.push({ role: role, text: text });
  }
  return turns.length ? turns : null;
}

function forModel(sections) {
  return sections.map(function (section) {
    return {
      id: section.id,
      title: section.title,
      url: section.url,
      lang: section.lang,
      text: String(section.text || "").replace(/\s+/g, " ").trim().slice(0, 1500),
    };
  });
}

function mergeSections(page, extra) {
  const seen = new Set();
  const out = [];
  const groups = [page, extra];
  for (let g = 0; g < groups.length; g += 1) {
    const list = groups[g];
    for (let i = 0; i < list.length; i += 1) {
      const section = list[i];
      const key = String(section.id || "") + "\n" + String(section.url || "") + "\n" + String(section.title || "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(section);
    }
  }
  return out;
}

function couldNotFind(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!value) return true;
  if (value === COULD_NOT_FIND.toLowerCase()) return true;
  return value.length < 180 && (value.includes("couldn't find") || value.includes("could not find") || value.includes("couldn’t find"));
}

function asyncRoute(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function mountDocs(app, specPath) {
  let spec = {
    openapi: "3.0.3",
    info: { title: "Savanna Assistant API", version: "0.2.0" },
    paths: {},
  };
  try {
    spec = parse(fs.readFileSync(specPath, "utf8"));
  } catch {
    spec.info.description = "openapi.yaml could not be read.";
  }
  const docs = swaggerUi.setup ? swaggerUi : swaggerUi.default;
  app.use("/docs", docs.serve, docs.setup(spec, { customSiteTitle: "Savanna Assistant API" }));
  app.get("/openapi.yaml", function (_req, res) {
    res.type("text/yaml");
    try {
      res.send(fs.readFileSync(specPath));
    } catch {
      res.status(404).json({ error: "That address is not available." });
    }
  });
}

export { safeUrl };
