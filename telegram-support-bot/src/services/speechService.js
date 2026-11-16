import { config } from '../config.js';
import { safeError } from '../utils/safeLog.js';

const ADDIS_LANGS = new Set(['am', 'om', 'ti', 'so']);
const ADDIS_VOICES = { am: 'am-hamen', om: 'om-bikila', ti: 'ti-berhane' };
const EDGE_VOICES = {
  en: 'en-US-AriaNeural',
  ar: 'ar-SA-ZariyahNeural',
  am: 'am-ET-MekdesNeural',
  so: 'so-SO-UbaxNeural',
};
const voiceCache = new Map();

export function spokenText(text) {
  return String(text || '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

/**
 * Addis for am, om, ti, and so when a key is set. English and Arabic stay on Edge.
 * Amharic and Somali can fall back to Edge. Oromo and Tigrinya have no Edge voice,
 * so they stay silent until Addis returns audio. The text reply is still sent.
 */
export function voicePlan(language, addisConfigured) {
  if (ADDIS_LANGS.has(language)) {
    if (addisConfigured) {
      return { engine: 'addis', edgeVoice: EDGE_VOICES[language] || '' };
    }
    if (EDGE_VOICES[language]) {
      return { engine: 'edge', edgeVoice: EDGE_VOICES[language] };
    }
    return { engine: 'none', edgeVoice: '' };
  }
  return { engine: 'edge', edgeVoice: EDGE_VOICES[language] || EDGE_VOICES.en };
}

export async function speak(text, language, options = {}) {
  const spoken = spokenText(text);
  if (!spoken) {
    return null;
  }
  const configured = options.addisConfigured ?? Boolean(config.addisKey);
  const plan = voicePlan(language, configured);
  if (plan.engine === 'none') {
    return null;
  }
  if (plan.engine === 'addis') {
    try {
      const audio = await addisSpeak(spoken, language, options);
      if (audio?.length) {
        return audio;
      }
    } catch (error) {
      console.error(`Addis speech failed: ${safeError(error)}`);
    }
    if (!plan.edgeVoice) {
      return null;
    }
  }
  try {
    const edge = options.edgeSpeak || edgeSpeak;
    const audio = await edge(spoken, plan.edgeVoice || EDGE_VOICES.en);
    return audio?.length ? audio : null;
  } catch (error) {
    console.error(`Edge speech failed: ${safeError(error)}`);
    return null;
  }
}

export const speech = {
  speak,
};

export async function addisSpeak(text, language, options = {}) {
  const key = options.key ?? config.addisKey;
  if (!key || !ADDIS_LANGS.has(language) || !text) {
    return null;
  }
  const fetchImpl = options.fetchImpl || fetch;
  const base = joinBase(options.base ?? config.addisBase);
  const voiceId = await chooseVoice(language, { ...options, key, fetchImpl, base });
  if (!voiceId) {
    return null;
  }
  const response = await fetchImpl(`${base}/api/v1/voice/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language,
      output_format: 'mp3_44100',
      client_request_id: crypto.randomUUID(),
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 20000),
  });
  const type = header(response, 'content-type');
  if (response.ok && /audio\/|octet-stream/i.test(type)) {
    return Buffer.from(await response.arrayBuffer());
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ref = audioRef(body);
  if (!ref) {
    return null;
  }
  if (ref.startsWith('data:')) {
    return bytesFromDataUrl(ref);
  }
  if (!/^https?:\/\//i.test(ref)) {
    return null;
  }
  const file = await fetchImpl(ref, { signal: AbortSignal.timeout(options.timeoutMs || 20000) });
  if (!file.ok) {
    return null;
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return bytes.length ? bytes : null;
}

async function chooseVoice(language, options) {
  const cache = options.cache || voiceCache;
  const hit = cache.get(language);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) {
    return hit.id;
  }
  const id = await lookupVoice(language, options);
  if (!id) {
    return '';
  }
  cache.set(language, { id, at: Date.now() });
  return id;
}

async function lookupVoice(language, options) {
  let response;
  try {
    response = await options.fetchImpl(`${options.base}/api/v1/voice/voices?language=${encodeURIComponent(language)}`, {
      headers: { 'x-api-key': options.key, accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs || 20000),
    });
  } catch {
    return ADDIS_VOICES[language] || '';
  }
  if (!response.ok) {
    return ADDIS_VOICES[language] || '';
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    return ADDIS_VOICES[language] || '';
  }
  return firstVoice(body) || ADDIS_VOICES[language] || '';
}

function firstVoice(body) {
  const list = asList(body);
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    if (entry.is_available === false || entry.isAvailable === false) {
      continue;
    }
    const id = entry.id || entry.voice_id || entry.voiceId;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
  }
  return '';
}

function asList(body) {
  if (Array.isArray(body)) {
    return body;
  }
  if (!body || typeof body !== 'object') {
    return [];
  }
  if (Array.isArray(body.data)) {
    return body.data;
  }
  if (Array.isArray(body.voices)) {
    return body.voices;
  }
  if (body.data && Array.isArray(body.data.voices)) {
    return body.data.voices;
  }
  return [];
}

function audioRef(body) {
  const piles = [body, body && body.data, body && body.clip];
  const keys = ['audio_url', 'audioUrl', 'url'];
  for (const pile of piles) {
    if (!pile || typeof pile !== 'object' || Array.isArray(pile)) {
      continue;
    }
    for (const key of keys) {
      const value = pile[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return '';
}

function bytesFromDataUrl(ref) {
  const match = ref.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) {
    return null;
  }
  const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]));
  return bytes.length ? bytes : null;
}

function joinBase(value) {
  const root = String(value || 'https://api.addisassistant.com').replace(/\/$/, '');
  return root.endsWith('/api/v1') ? root.slice(0, -'/api/v1'.length) : root;
}

function header(response, name) {
  if (!response?.headers || typeof response.headers.get !== 'function') {
    return '';
  }
  return response.headers.get(name) || '';
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function edgeSpeak(text, voice) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 30000 });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(xmlEscape(text));
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audio = Buffer.concat(chunks);
    return audio.length ? audio : null;
  } finally {
    tts.close();
  }
}
