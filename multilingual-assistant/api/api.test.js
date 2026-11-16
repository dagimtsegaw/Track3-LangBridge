import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { fitSms } from "./lib/smsText.js";

const sections = [
  {
    id: "shaping",
    title: "What is Shaping the Future of VA Work?",
    url: "/pages/concept-with-navigation.html#what-is-shaping-the-future-of-va-work",
    lang: "en",
    text: "More remote-first businesses. Companies hire remotely. Artificial Intelligence is making it easier to draft and schedule.",
  },
  {
    id: "bakery",
    title: "Bakery notes",
    url: "/demo/data/jobs.json#test-job-social",
    lang: "en",
    text: "A pretend bakery wants a weekly social media calendar.",
  },
];

function tempFile() {
  return path.join(os.tmpdir(), "db-escalations-" + process.pid + "-" + Math.random().toString(16).slice(2) + ".json");
}

async function listen(app) {
  const server = createServer(app);
  await new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  return {
    base: "http://127.0.0.1:" + port,
    close: async function () {
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
      await new Promise(function (resolve) {
        server.close(function () {
          resolve();
        });
      });
    },
  };
}

test("sms text stays within 160 characters and keeps the section name", function () {
  const reply = fitSms({
    text: "word ".repeat(80),
    sources: [{ title: "Test listing: Inbox assistant", url: "/demo/data/jobs.json#test-job-inbox" }],
  });
  assert.ok(reply.length <= 160, reply.length + " " + reply);
  assert.ok(reply.includes("Inbox assistant"));
  assert.equal(fitSms({ text: null, sources: [] }).length <= 160, true);
});

test("ask uses the model only for sections above the threshold", async function () {
  const calls = [];
  const logs = [];
  const original = console.error;
  console.error = function () {
    logs.push(Array.from(arguments).join(" "));
  };
  const app = createApp({
    env: {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-key-should-not-appear",
      GEMINI_MODEL: "fake-model",
      ALLOWED_ORIGINS: "http://localhost:8080",
      HELPER_TOKEN: "helper-test",
    },
    sections: sections,
    dataFile: tempFile(),
    fetchImpl: async function (url, opts) {
      calls.push({ url: String(url), body: opts && opts.body });
      return {
        ok: true,
      json: async function () {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: "Remote-first companies hire remotely. See http://evil.example/fake" }],
              },
            },
          ],
        };
      },
      };
    },
  });
  const server = await listen(app);
  try {
    const hit = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What is shaping remote-first businesses?",
        language: "en",
        sections: sections,
      }),
    });
    const hitBody = await hit.json();
    assert.equal(hit.status, 200);
    assert.equal(hitBody.mode, "gemini");
    assert.match(hitBody.answer, /remotely/);
    assert.equal(hitBody.sources.length, 1);
    assert.equal(hitBody.sources[0].url, sections[0].url);
    assert.equal(hitBody.sources.some(function (source) { return String(source.url).includes("evil.example"); }), false);
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /remote-first/);
    assert.equal(calls[0].body.includes("Bakery"), false);
    assert.equal(calls[0].body.includes("pretend bakery"), false);
    assert.equal(calls[0].body.includes("test-key-should-not-appear"), false);

    const hello = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "helo", language: "en", sections: sections }),
    });
    const helloBody = await hello.json();
    assert.equal(hello.status, 200);
    assert.equal(helloBody.mode, "greeting");
    assert.match(helloBody.answer, /What can I help you with/);
    assert.equal(calls.length, 1);

    const miss = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "zzzz quantum pottery", language: "en", sections: sections }),
    });
    const missBody = await miss.json();
    assert.equal(miss.status, 200);
    assert.equal(missBody.answer, null);
    assert.equal(missBody.mode, "not-found");
    assert.equal(calls.length, 1);
    assert.equal(calls.some(function (call) { return String(call.body).includes("Bakery") || String(call.body).includes("pottery"); }), false);

    const health = await fetch(server.base + "/api/v1/health");
    const healthBody = await health.json();
    assert.deepEqual(healthBody, { ai: true, ttsAddis: false, ttsGemini: true, escalations: true, telegram: "" });
    assert.equal(logs.some(function (line) { return line.includes("test-key-should-not-appear"); }), false);
  } finally {
    console.error = original;
    await server.close();
  }
});

test("a failed model falls back to the lesson excerpt", async function () {
  const app = createApp({
    env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key-should-not-appear", GEMINI_MODEL: "fake-model" },
    sections: sections,
    dataFile: tempFile(),
    geminiTimeoutMs: 30,
    fetchImpl: function (_url, opts) {
      return new Promise(function (_resolve, reject) {
        const timer = setTimeout(function () {
          reject(new Error("hung"));
        }, 1000);
        if (opts && opts.signal) {
          opts.signal.addEventListener("abort", function () {
            clearTimeout(timer);
            reject(opts.signal.reason || new Error("aborted"));
          });
        }
      });
    },
  });
  const server = await listen(app);
  try {
    const response = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What is shaping remote-first businesses?",
        language: "en",
        sections: sections,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "offline-fallback");
    assert.equal(sections[0].text.includes(body.answer.replace(/^…/, "").replace(/…$/, "").slice(0, 40)), true);
    assert.equal(body.sources[0].url, sections[0].url);
  } finally {
    await server.close();
  }
});

test("sms reply from the same answer path is at most 160 characters", async function () {
  const long = ("weekday inbox sorting for a sample client. ").repeat(30);
  const app = createApp({
    env: { AI_PROVIDER: "none" },
    sections: [
      {
        id: "test-job-inbox",
        title: "Test listing: Inbox assistant",
        url: "/demo/data/jobs.json#test-job-inbox",
        lang: "en",
        text: long,
      },
    ],
    dataFile: tempFile(),
    fetchImpl: function () {
      throw new Error("sms must not call a model when AI is off");
    },
  });
  const server = await listen(app);
  try {
    const response = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "+251900000000", text: "weekday inbox sorting" }),
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/plain/);
    assert.ok(text.length <= 160, String(text.length));
    assert.ok(text.includes("Inbox assistant"));
  } finally {
    await server.close();
  }
});

test("escalations require the helper token and notify a webhook", async function () {
  const dataFile = tempFile();
  const hooks = [];
  const app = createApp({
    env: { AI_PROVIDER: "none", HELPER_TOKEN: "helper-test" },
    sections: sections,
    dataFile: dataFile,
    fetchImpl: async function (url, opts) {
      hooks.push({ url: String(url), body: opts && opts.body });
      return { ok: true, json: async function () { return {}; } };
    },
  });
  const server = await listen(app);
  try {
    const denied = await fetch(server.base + "/api/v1/escalations");
    assert.equal(denied.status, 401);

    const registered = await fetch(server.base + "/api/v1/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/hook", events: ["escalation.opened"] }),
    });
    assert.equal(registered.status, 201);

    const opened = await fetch(server.base + "/api/v1/escalations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "am",
        contact: "0911223344",
        conversation: [{ role: "learner", text: "I need a person" }],
      }),
    });
    const openedBody = await opened.json();
    assert.equal(opened.status, 201);
    assert.match(openedBody.ticketId, /^db-/);
    assert.equal(hooks.length, 1);
    assert.match(hooks[0].body, new RegExp(openedBody.ticketId));
    assert.equal(hooks[0].body.includes("911223344"), false);

    const waiting = await fetch(server.base + "/api/v1/escalations", {
      headers: { authorization: "Bearer helper-test" },
    });
    const waitingBody = await waiting.json();
    assert.equal(waiting.status, 200);
    assert.equal(waitingBody.tickets.length, 1);
    assert.equal(waitingBody.tickets[0].contact, "+251911223344");
    assert.equal(waitingBody.tickets[0].conversation[0].text, "I need a person");

    const answered = await fetch(server.base + "/api/v1/escalations/" + openedBody.ticketId, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-helper-token": "helper-test" },
      body: JSON.stringify({ note: "Called them back." }),
    });
    assert.equal(answered.status, 200);
    const after = await fetch(server.base + "/api/v1/escalations", {
      headers: { authorization: "Bearer helper-test" },
    });
    const afterBody = await after.json();
    assert.equal(afterBody.tickets.length, 0);
    assert.equal(waitingBody.tickets[0].topic, "tutor");
    assert.equal(waitingBody.tickets[0].page, null);
  } finally {
    await server.close();
    fs.rmSync(dataFile, { force: true });
  }
});

test("a ticket keeps topic, page context, and listings, and the webhook omits them", async function () {
  const dataFile = tempFile();
  const hooks = [];
  const app = createApp({
    env: { AI_PROVIDER: "none", HELPER_TOKEN: "helper-test", TELEGRAM_BOT_USERNAME: "@SavannaTutorBot" },
    sections: sections,
    dataFile: dataFile,
    fetchImpl: async function (url, opts) {
      hooks.push({ url: String(url), body: opts && opts.body });
      return { ok: true, json: async function () { return {}; } };
    },
  });
  const server = await listen(app);
  try {
    const health = await fetch(server.base + "/api/v1/health");
    const healthBody = await health.json();
    assert.equal(healthBody.telegram, "SavannaTutorBot");

    const registered = await fetch(server.base + "/api/v1/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/hook", events: ["escalation.opened"] }),
    });
    assert.equal(registered.status, 201);

    const bad = await fetch(server.base + "/api/v1/escalations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "visa", conversation: "help" }),
    });
    assert.equal(bad.status, 400);

    const opened = await fetch(server.base + "/api/v1/escalations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "en",
        topic: "accommodation",
        conversation: [{ role: "learner", text: "I need an accommodation for my interview" }],
        page: {
          url: "http://localhost:8080/demo/blank.html",
          heading: "Blank page",
          selection: "selected line",
        },
        context: [
          {
            title: "Test listing: Inbox assistant",
            url: "/demo/data/jobs.json#test-job-inbox",
            text: "Test listing only, not a real vacancy.",
          },
        ],
      }),
    });
    const openedBody = await opened.json();
    assert.equal(opened.status, 201);
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].body.includes("blank.html"), false);
    assert.equal(hooks[0].body.includes("Inbox"), false);
    assert.match(hooks[0].body, /escalation\.opened/);

    const waiting = await fetch(server.base + "/api/v1/escalations", {
      headers: { authorization: "Bearer helper-test" },
    });
    const waitingBody = await waiting.json();
    assert.equal(waiting.status, 200);
    assert.equal(waitingBody.tickets.length, 1);
    assert.equal(waitingBody.tickets[0].ticketId, openedBody.ticketId);
    assert.equal(waitingBody.tickets[0].topic, "accommodation");
    assert.equal(waitingBody.tickets[0].page.heading, "Blank page");
    assert.equal(waitingBody.tickets[0].page.selection, "selected line");
    assert.equal(waitingBody.tickets[0].context[0].title, "Test listing: Inbox assistant");
  } finally {
    await server.close();
    fs.rmSync(dataFile, { force: true });
  }
});

test("translate keeps order and length and rejects an oversized batch", async function () {
  const calls = [];
  const app = createApp({
    env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key-should-not-appear", GEMINI_MODEL: "fake-model" },
    sections: [],
    dataFile: tempFile(),
    fetchImpl: async function (_url, opts) {
      calls.push(opts && opts.body);
      return {
        ok: true,
        json: async function () {
          return { candidates: [{ content: { parts: [{ text: "[\"ሀ\", \"\", \"ሐ\"]" }] } }] };
        },
      };
    },
  });
  const server = await listen(app);
  try {
    const response = await fetch(server.base + "/api/v1/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: ["one", "two", "three"], target: "am" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.texts, ["ሀ", "two", "ሐ"]);
    assert.equal(body.texts.length, 3);
    assert.match(calls[0], /proper names/);
    assert.match(calls[0], /URLs/);
    assert.match(calls[0], /numbers/);

    const shortApp = createApp({
      env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key-should-not-appear", GEMINI_MODEL: "fake-model" },
      sections: [],
      dataFile: tempFile(),
      fetchImpl: async function () {
        return {
          ok: true,
          json: async function () {
            return { candidates: [{ content: { parts: [{ text: "[\"ሀ\"]" }] } }] };
          },
        };
      },
    });
    const shortServer = await listen(shortApp);
    try {
      const partial = await fetch(shortServer.base + "/api/v1/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts: ["alpha", "beta", "gamma"], target: "om" }),
      });
      const partialBody = await partial.json();
      assert.equal(partial.status, 200);
      assert.deepEqual(partialBody.texts, ["ሀ", "beta", "gamma"]);
    } finally {
      await shortServer.close();
    }

    const tooMany = await fetch(server.base + "/api/v1/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: new Array(21).fill("word"), target: "am" }),
    });
    const tooManyBody = await tooMany.json();
    assert.equal(tooMany.status, 400);
    assert.equal(typeof tooManyBody.error, "string");

    const tooLong = await fetch(server.base + "/api/v1/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: ["x".repeat(2001)], target: "am" }),
    });
    const tooLongBody = await tooLong.json();
    assert.equal(tooLong.status, 400);
    assert.equal(typeof tooLongBody.error, "string");

    const off = createApp({
      env: { AI_PROVIDER: "none" },
      sections: [],
      dataFile: tempFile(),
      fetchImpl: async function () {
        throw new Error("should not be called");
      },
    });
    const offServer = await listen(off);
    try {
      const blocked = await fetch(offServer.base + "/api/v1/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts: ["Hello"], target: "am" }),
      });
      const blockedBody = await blocked.json();
      assert.equal(blocked.status, 503);
      assert.equal(typeof blockedBody.error, "string");
    } finally {
      await offServer.close();
    }
  } finally {
    await server.close();
  }
});

test("translate reports a retired model and retries a rate limit once", async function () {
  const logs = [];
  const original = console.error;
  console.error = function () {
    logs.push(Array.from(arguments).join(" "));
  };
  const missing = createApp({
    env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key-should-not-appear", GEMINI_MODEL: "gemini-2.5-flash" },
    sections: [],
    dataFile: tempFile(),
    fetchImpl: async function () {
      return {
        ok: false,
        status: 404,
        json: async function () {
          return { error: { message: "models/gemini-2.5-flash is no longer available. key test-key-should-not-appear" } };
        },
      };
    },
  });
  const missingServer = await listen(missing);
  const waits = [];
  let calls = 0;
  const { createGemini } = await import("./lib/gemini.js");
  const direct = createGemini({
    key: "test-key-should-not-appear",
    model: "gemini-3.8-flash",
    ttsModel: "tts",
    sleep: function (ms) {
      waits.push(ms);
      return Promise.resolve();
    },
    fetchImpl: async function () {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: function () { return "1"; } },
          json: async function () {
            return { error: { message: "slow down" } };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { candidates: [{ content: { parts: [{ text: "```json\n[\"ሰላም\"]\n```" }] } }] };
        },
      };
    },
  });
  try {
    const gone = await fetch(missingServer.base + "/api/v1/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: ["Hello"], target: "am" }),
    });
    const goneBody = await gone.json();
    assert.equal(gone.status, 502);
    assert.equal(goneBody.reason, "bad_model");
    assert.equal(typeof goneBody.error, "string");
    assert.equal(logs.some(function (line) { return line.includes("404") && line.includes("no longer available"); }), true);
    assert.equal(logs.some(function (line) { return line.includes("test-key-should-not-appear"); }), false);

    const translated = await direct.translate({ texts: ["Hello"], target: "am" });
    assert.deepEqual(translated, ["ሰላም"]);
    assert.equal(calls, 2);
    assert.deepEqual(waits, [1000]);
  } finally {
    console.error = original;
    await missingServer.close();
  }
});

test("advice questions skip the model and return no excerpt", async function () {
  const calls = [];
  const app = createApp({
    env: {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-key-should-not-appear",
      GEMINI_MODEL: "fake-model",
    },
    sections: [
      {
        id: "visa",
        title: "Visa notes",
        url: "/visa",
        lang: "en",
        text: "Bring your visa and passport to the office.",
      },
    ],
    dataFile: tempFile(),
    fetchImpl: async function (url, opts) {
      calls.push({ url: String(url), body: opts && opts.body });
      return {
        ok: true,
        json: async function () {
          return { candidates: [{ content: { parts: [{ text: "Bring your visa." }] } }] };
        },
      };
    },
  });
  const server = await listen(app);
  try {
    const asked = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "How do I get a visa?", language: "en" }),
    });
    const body = await asked.json();
    assert.equal(asked.status, 200);
    assert.equal(body.mode, "advice");
    assert.equal(body.answer, "Please talk to a person.");
    assert.deepEqual(body.sources, []);
    assert.equal(String(body.answer).includes("passport"), false);

    const sms = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "What medicine dose should I take?" }),
    });
    const smsText = await sms.text();
    assert.equal(sms.status, 200);
    assert.equal(smsText, "Please talk to a person.");
    assert.equal(calls.length, 0);
  } finally {
    await server.close();
  }
});

test("sms answers an Amharic question in Amharic", async function () {
  const app = createApp({
    env: { AI_PROVIDER: "none" },
    sections: [
      {
        id: "am-va",
        title: "ምናባዊ ረዳት",
        url: "#am-va",
        lang: "am",
        text: "ምናባዊ ረዳት ሥራውን በሰው ችሎታ እና በመሳሪያ ይደግፋል።",
      },
    ],
    dataFile: tempFile(),
    fetchImpl: function () {
      throw new Error("sms must not call a model");
    },
  });
  const server = await listen(app);
  try {
    const response = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "+251900000000", text: "ምናባዊ ረዳቶች ሥራ?" }),
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.ok(text.includes("በሰው ችሎታ"), text);
    assert.ok(text.includes("ምናባዊ ረዳት"), text);
    assert.equal(text.includes("Couldn't find"), false);

    const hello = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ሰላም" }),
    });
    const helloText = await hello.text();
    assert.match(helloText, /በምን ልርዳዎ/);
    assert.equal(helloText.includes("What can I help you with"), false);

    const oromo = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "om", text: "akkam" }),
    });
    const oromoText = await oromo.text();
    assert.match(oromoText, /gargaaru/);
    assert.equal(oromoText.includes("What can I help you with"), false);
  } finally {
    await server.close();
  }
});

test("posted content is what later questions and texts search", async function () {
  const app = createApp({
    env: { AI_PROVIDER: "none" },
    sections: sections,
    dataFile: tempFile(),
  });
  const server = await listen(app);
  try {
    const empty = await fetch(server.base + "/api/v1/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const emptyBody = await empty.json();
    assert.equal(empty.status, 400);
    assert.equal(typeof emptyBody.error, "string");
    assert.ok(emptyBody.error.length > 10);

    const tooMany = await fetch(server.base + "/api/v1/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sections: Array.from({ length: 41 }, function (_, i) {
          return { id: "s" + i, title: "Section " + i, url: "/s", text: "text", lang: "en" };
        }),
      }),
    });
    assert.equal(tooMany.status, 400);

    const indexed = await fetch(server.base + "/api/v1/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sections: [
          {
            id: "hosted",
            title: "Hosted purple notes",
            url: "/host#purple",
            text: "The hosted page explains purple calendar holds for the test index.",
            lang: "en",
          },
        ],
      }),
    });
    const indexedBody = await indexed.json();
    assert.equal(indexed.status, 201);
    assert.equal(indexedBody.indexed, 1);

    const asked = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "purple calendar holds", language: "en" }),
    });
    const askedBody = await asked.json();
    assert.equal(asked.status, 200);
    assert.match(askedBody.answer, /purple calendar holds/);
    assert.equal(askedBody.sources[0].url, "/host#purple");

    const sms = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "0711223344", text: "purple calendar holds" }),
    });
    const smsText = await sms.text();
    assert.equal(sms.status, 200);
    assert.match(smsText, /purple|Hosted/);

    const badFrom = await fetch(server.base + "/sms/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "Ada", text: "purple calendar holds" }),
    });
    const badText = await badFrom.text();
    assert.equal(badFrom.status, 400);
    assert.match(badText, /Ethiopian mobile/);

    const badContact = await fetch(server.base + "/api/v1/escalations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact: "Ada", conversation: "help" }),
    });
    const badContactBody = await badContact.json();
    assert.equal(badContact.status, 400);
    assert.match(badContactBody.error, /Ethiopian mobile/);
  } finally {
    await server.close();
  }
});

test("ollama answers from retrieved sections and falls back when it fails", async function () {
  const calls = [];
  const app = createApp({
    env: {
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OLLAMA_MODEL: "test-model",
    },
    sections: sections,
    dataFile: tempFile(),
    fetchImpl: async function (url, opts) {
      calls.push({ url: String(url), body: opts && opts.body });
      return {
        ok: true,
        json: async function () {
          return { choices: [{ message: { content: "Remote-first companies hire remotely." } }] };
        },
      };
    },
  });
  const server = await listen(app);
  try {
    const health = await fetch(server.base + "/api/v1/health");
    const healthBody = await health.json();
    assert.equal(healthBody.ai, true);
    assert.equal(healthBody.ttsGemini, false);

    const advice = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "what visa do I need", language: "en", sections: sections }),
    });
    const adviceBody = await advice.json();
    assert.equal(adviceBody.mode, "advice");
    assert.equal(calls.length, 0);

    const hit = await fetch(server.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What is shaping remote-first businesses?",
        language: "en",
        sections: sections,
      }),
    });
    const hitBody = await hit.json();
    assert.equal(hit.status, 200);
    assert.equal(hitBody.mode, "ollama");
    assert.match(hitBody.answer, /remotely/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v1\/chat\/completions$/);
    assert.match(calls[0].body, /test-model/);
    assert.match(calls[0].body, /Refuse medical, legal, and immigration advice/);
    assert.match(calls[0].body, /remote-first/);
    assert.equal(calls[0].body.includes("Bakery"), false);
    assert.equal(calls[0].body.includes("pretend bakery"), false);
  } finally {
    await server.close();
  }

  const failed = createApp({
    env: {
      AI_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OLLAMA_MODEL: "test-model",
    },
    sections: sections,
    dataFile: tempFile(),
    ollamaTimeoutMs: 30,
    fetchImpl: function () {
      return Promise.reject(new Error("down"));
    },
  });
  const down = await listen(failed);
  try {
    const response = await fetch(down.base + "/api/v1/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What is shaping remote-first businesses?",
        language: "en",
        sections: sections,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "offline-fallback");
    assert.match(body.answer, /remotely|remote/i);
  } finally {
    await down.close();
  }
});

test("an unknown escalation returns 404", async function () {
  const dataFile = tempFile();
  const app = createApp({
    env: { AI_PROVIDER: "none", HELPER_TOKEN: "helper-test" },
    sections: [],
    dataFile: dataFile,
  });
  const server = await listen(app);
  try {
    const response = await fetch(server.base + "/api/v1/escalations/db-deadbeef", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-helper-token": "helper-test" },
      body: JSON.stringify({ note: "missing" }),
    });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(typeof body.error, "string");
  } finally {
    await server.close();
    fs.rmSync(dataFile, { force: true });
  }
});
