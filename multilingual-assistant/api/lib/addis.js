/**
 * Addis Voices 2 adapter.
 *
 * Checked against https://docs.addisassistant.com/docs/capabilities/text-to-speech
 * (catalog note on that page: 4 Nov 2026):
 * - POST {origin}/api/v1/voice/generations
 * - Header: x-api-key
 * - JSON: text, voice_id, language, output_format "mp3_44100", optional client_request_id
 * - The documented curl reads .data.audio_url (signed URL). A first response may
 *   also include a data: URL. This file fetches that URL and returns bytes.
 * - GET {origin}/api/v1/voice/voices?language= lists voices.
 * - Example ids on that page: am-hamen, om-bikila, ti-berhane.
 *
 * TODO — confirm with a real ADDIS_API_KEY before treating speech as done:
 * 1. Somali (`so`) is not in the documented language list
 *    (am, om, ti, sw, ha, sid, wal). No Somali voice id is sent. A miss returns 501.
 * 2. The voices-list JSON envelope is not in the curl example. Several shapes
 *    are accepted. Confirm which one the live API returns.
 * 3. Confirm the audio field is still data.audio_url and that the signed URL
 *    can be downloaded without sending the API key again.
 * 4. If the catalog request fails, am/om/ti fall back to the example ids above.
 *    Confirm those ids are still available.
 */

import { randomUUID } from "node:crypto";

export function createAddis(options) {
  const key = options.key;
  const base = joinBase(options.base);
  const fetchImpl = options.fetchImpl;
  const timeoutMs = options.timeoutMs || 20000;
  const voiceIds = options.voices || {};
  const voiceTtlMs = 60 * 60 * 1000;
  const voices = new Map();

  return {
    async speak(text, language) {
      const voice = await chooseVoice(language);
      const response = await fetchImpl(base + "/api/v1/voice/generations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify({
          text: text,
          voice_id: voice,
          language: language,
          output_format: "mp3_44100",
          client_request_id: randomUUID(),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const type = header(response, "content-type");
      if (response.ok && /audio\/|octet-stream/i.test(type)) {
        return {
          mime: type.split(";")[0] || "audio/mpeg",
          bytes: Buffer.from(await response.arrayBuffer()),
          mock: false,
        };
      }
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok || !body) fail(502);
      const ref = audioRef(body);
      if (!ref) fail(502);
      if (ref.startsWith("data:")) return dataUrl(ref);
      if (!/^https?:\/\//i.test(ref)) fail(502);
      const file = await fetchImpl(ref, { signal: AbortSignal.timeout(timeoutMs) });
      if (!file.ok) fail(502);
      const fileType = header(file, "content-type");
      const mime = /audio\//i.test(fileType) ? fileType.split(";")[0] : "audio/mpeg";
      return { mime: mime, bytes: Buffer.from(await file.arrayBuffer()), mock: false };
    },
  };

  /** Read-on-hover asks for many short clips. One catalog lookup per language per hour is enough. */
  async function chooseVoice(language) {
    const hit = voices.get(language);
    if (hit && Date.now() - hit.at < voiceTtlMs) return hit.id;
    const id = await lookupVoice(language);
    voices.set(language, { id: id, at: Date.now() });
    return id;
  }

  async function lookupVoice(language) {
    let response;
    try {
      response = await fetchImpl(base + "/api/v1/voice/voices?language=" + encodeURIComponent(language), {
        headers: { "x-api-key": key, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return fallback(language, voiceIds);
    }
    if (!response.ok) return fallback(language, voiceIds);
    let body = null;
    try {
      body = await response.json();
    } catch {
      return fallback(language, voiceIds);
    }
    const id = firstVoice(body);
    if (id) return id;
    const error = new Error("The speech service has no voice for this language.");
    error.status = language === "so" ? 501 : 502;
    throw error;
  }
}

function fallback(language, voices) {
  if (voices && voices[language]) return voices[language];
  const error = new Error(
    language === "so"
      ? "Somali speech is not in the configured speech catalog."
      : "The speech service has no voice for this language."
  );
  error.status = 501;
  throw error;
}

function firstVoice(body) {
  const list = asList(body);
  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    if (!entry || typeof entry !== "object") continue;
    if (entry.is_available === false || entry.isAvailable === false) continue;
    const id = entry.id || entry.voice_id || entry.voiceId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return "";
}

function asList(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.voices)) return body.voices;
  if (body.data && Array.isArray(body.data.voices)) return body.data.voices;
  return [];
}

function audioRef(body) {
  const piles = [body, body && body.data, body && body.clip];
  const keys = ["audio_url", "audioUrl", "url"];
  for (let i = 0; i < piles.length; i += 1) {
    const pile = piles[i];
    if (!pile || typeof pile !== "object") continue;
    for (let k = 0; k < keys.length; k += 1) {
      const value = pile[keys[k]];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

function dataUrl(ref) {
  const match = ref.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) fail(502);
  const mime = match[1] || "audio/mpeg";
  const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  return { mime: mime, bytes: bytes, mock: false };
}

function joinBase(value) {
  const root = String(value || "https://api.addisassistant.com").replace(/\/$/, "");
  return root.endsWith("/api/v1") ? root.slice(0, -"/api/v1".length) : root;
}

function header(response, name) {
  if (!response || !response.headers || typeof response.headers.get !== "function") return "";
  return response.headers.get(name) || "";
}

function fail(status) {
  const error = new Error("The speech service did not return audio.");
  error.status = status;
  throw error;
}

/** A short silent WAV so local mock mode is real audio, not a pretend voice. */
export function mockWav() {
  const samples = 800;
  const pcm = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
