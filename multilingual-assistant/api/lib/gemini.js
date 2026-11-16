/**
 * Gemini REST calls. The key is sent as a header and is never written to a URL
 * or a log line. Ask, translate, and English speech share this client.
 */

const HOST = "https://generativelanguage.googleapis.com/v1beta/models/";

const TRANSLATE_RULES =
  "Translate each string into the requested language and do nothing else. Keep numbers, URLs, and proper names unchanged. Return a JSON array of strings with the same length and the same order. Do not add commentary.";

export const COULD_NOT_FIND = "I could not find this in the course.";

const ASK_RULES = [
  "Answer only from the provided sections. They may be lesson text or ALX information.",
  "The question may have typos, missing letters, or different wording. Treat that as the same question when the meaning matches a section.",
  "Write in the user's language.",
  "Mention the section title in a normal sentence. Do not prefix it with a label.",
  "If the person is only greeting you, thanking you, or making small talk, reply with a short hello and ask what you can help with. Do not say you could not find it.",
  "If the sections do not contain the answer, reply with exactly this sentence and nothing else: " + COULD_NOT_FIND,
  "Refuse medical, legal, and immigration advice and tell the person to talk to a human.",
  "Never invent facts, fees, dates, eligibility rules, names, numbers, or sources that are not in the sections.",
].join(" ");

export function createGemini(options) {
  const key = options.key;
  const model = options.model;
  const ttsModel = options.ttsModel;
  const fetchImpl = options.fetchImpl;
  const timeoutMs = options.timeoutMs || 12000;
  const sleep = options.sleep || function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  };

  async function generate(body, modelName, allowRetry) {
    const response = await fetchImpl(HOST + encodeURIComponent(modelName) + ":generateContent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 429 && allowRetry !== false) {
      const message = await errorMessage(response, key);
      console.error("gemini 429 " + message);
      await sleep(retryAfterMs(response));
      return generate(body, modelName, false);
    }
    if (!response.ok) {
      const message = await errorMessage(response, key);
      const reason = reasonFor(response.status, message);
      console.error("gemini " + response.status + " " + message);
      const error = new Error(message || "gemini");
      error.status = response.status;
      error.reason = reason;
      throw error;
    }
    return response.json();
  }

  return {
    async answer({ question, language, sections }) {
      const packed = sections
        .map(function (section) {
          return "Title: " + section.title + "\nURL: " + section.url + "\n" + section.text;
        })
        .join("\n\n---\n\n");
      const data = await generate(
        {
          systemInstruction: { parts: [{ text: ASK_RULES }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Language: " + language + "\n\nQuestion: " + question + "\n\nSections:\n" + packed,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        },
        model
      );
      return textOf(data);
    },

    async translate({ texts, target }) {
      const data = await generate(
        {
          systemInstruction: {
            parts: [
              {
                text: TRANSLATE_RULES + " Target language: \"" + target + "\".",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(texts) }] }],
          generationConfig: { temperature: 0 },
        },
        model
      );
      return parseStringArray(textOf(data), texts);
    },

    async speak(text) {
      const data = await generate(
        {
          contents: [{ role: "user", parts: [{ text: text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
            },
          },
        },
        ttsModel
      );
      const audio = audioOf(data);
      if (!audio) {
        const error = new Error("The speech service did not return audio.");
        error.status = 502;
        throw error;
      }
      return { mime: audio.mime, bytes: audio.bytes, mock: false };
    },
  };
}

function partsOf(data) {
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  return Array.isArray(parts) ? parts : [];
}

function textOf(data) {
  return partsOf(data)
    .filter(function (part) {
      return part && part.thought !== true;
    })
    .map(function (part) {
      return part && typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();
}

function redact(text, key) {
  let message = String(text || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (key) message = message.split(key).join("[redacted]");
  return message;
}

async function errorMessage(response, key) {
  let message = "";
  try {
    const data = typeof response.json === "function" ? await response.json() : null;
    const err = data && data.error;
    if (err && typeof err.message === "string") message = err.message;
    else if (typeof err === "string") message = err;
    else if (err && typeof err.status === "string") message = err.status;
  } catch {
    message = "";
  }
  return redact(message, key);
}

function retryAfterMs(response) {
  let header = "";
  try {
    header = response.headers && response.headers.get ? response.headers.get("retry-after") : "";
  } catch {
    header = "";
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.round(seconds * 1000), 5000);
  return 1000;
}

function reasonFor(status, message) {
  const lower = String(message || "").toLowerCase();
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "bad_key";
  if (status === 404 || (status === 400 && (lower.includes("model") || lower.includes("not found") || lower.includes("no longer available")))) {
    return "bad_model";
  }
  if (lower.includes("api key") || lower.includes("api_key")) return "bad_key";
  return "bad_response";
}

function audioOf(data) {
  const parts = partsOf(data);
  for (let i = 0; i < parts.length; i += 1) {
    const inline = parts[i] && (parts[i].inlineData || parts[i].inline_data);
    if (!inline || typeof inline.data !== "string") continue;
    const mime = String(inline.mimeType || inline.mime_type || "");
    const bytes = Buffer.from(inline.data, "base64");
    if (/wav/i.test(mime) || /mpeg|mp3/i.test(mime)) return { mime: mime, bytes: bytes };
    const rate = Number((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
    return { mime: "audio/wav", bytes: pcmToWav(bytes, rate) };
  }
  return null;
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseJsonValue(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("[");
    const end = source.lastIndexOf("]");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function parseStringArray(text, originals) {
  const data = parseJsonValue(text);
  if (!Array.isArray(data)) {
    console.error("gemini 200 bad_response");
    const error = new Error("The translation service sent a response that could not be used.");
    error.status = 502;
    error.reason = "bad_response";
    throw error;
  }
  return originals.map(function (original, index) {
    const item = data[index];
    if (typeof item !== "string" || item.trim() === "") return original;
    return item;
  });
}
