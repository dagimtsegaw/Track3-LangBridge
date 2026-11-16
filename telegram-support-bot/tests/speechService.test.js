import assert from 'node:assert/strict';
import test from 'node:test';
import { speak, spokenText, voicePlan } from '../src/services/speechService.js';

test('voice routing keeps English and Arabic on Edge', () => {
  assert.deepEqual(voicePlan('en', true), { engine: 'edge', edgeVoice: 'en-US-AriaNeural' });
  assert.deepEqual(voicePlan('ar', true), { engine: 'edge', edgeVoice: 'ar-SA-ZariyahNeural' });
  assert.deepEqual(voicePlan('am', true), { engine: 'addis', edgeVoice: 'am-ET-MekdesNeural' });
  assert.deepEqual(voicePlan('om', true), { engine: 'addis', edgeVoice: '' });
  assert.deepEqual(voicePlan('ti', true), { engine: 'addis', edgeVoice: '' });
  assert.deepEqual(voicePlan('so', true), { engine: 'addis', edgeVoice: 'so-SO-UbaxNeural' });
  assert.equal(voicePlan('om', false).engine, 'none');
  assert.equal(voicePlan('am', false).engine, 'edge');
});

test('spoken text drops links and keeps the words', () => {
  const spoken = spokenText('\u202BHello https://example.com/a world\u202C');
  assert.equal(spoken, 'Hello world');
});

test('Addis returns the audio bytes for Amharic and is not used for English', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/voices')) {
      return json({ data: [{ id: 'am-hamen', is_available: true }] });
    }
    return json({ data: { audio_url: 'data:audio/mpeg;base64,QQ==' } });
  };
  const audio = await speak('ሰላም', 'am', {
    addisConfigured: true,
    key: 'test-key',
    base: 'https://api.addisassistant.com',
    fetchImpl,
    edgeSpeak: async () => {
      throw new Error('English Edge must not speak Amharic when Addis returned audio');
    },
  });
  assert.equal(audio.toString(), 'A');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers['x-api-key'], 'test-key');
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.language, 'am');
  assert.equal(body.voice_id, 'am-hamen');
  assert.equal(body.output_format, 'mp3_44100');

  let edgeVoice = '';
  const english = await speak('Hello', 'en', {
    addisConfigured: true,
    key: 'test-key',
    fetchImpl: async () => {
      throw new Error('Addis must not be called for English');
    },
    edgeSpeak: async (_text, voice) => {
      edgeVoice = voice;
      return Buffer.from('edge');
    },
  });
  assert.equal(english.toString(), 'edge');
  assert.equal(edgeVoice, 'en-US-AriaNeural');
});

test('Oromo stays silent when Addis has no audio, and Somali falls back to Edge', async () => {
  const empty = async () => json({ data: [] });
  let edgeCalled = false;
  const oromo = await speak('Akkam', 'om', {
    addisConfigured: true,
    key: 'test-key',
    fetchImpl: empty,
    cache: new Map(),
    edgeSpeak: async () => {
      edgeCalled = true;
      return Buffer.from('no');
    },
  });
  assert.equal(oromo, null);
  assert.equal(edgeCalled, false);

  let somaliVoice = '';
  const somali = await speak('Salaan', 'so', {
    addisConfigured: true,
    key: 'test-key',
    fetchImpl: empty,
    cache: new Map(),
    edgeSpeak: async (_text, voice) => {
      somaliVoice = voice;
      return Buffer.from('so');
    },
  });
  assert.equal(somali.toString(), 'so');
  assert.equal(somaliVoice, 'so-SO-UbaxNeural');
});

function json(body) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
    arrayBuffer: async () => Buffer.alloc(0),
  };
}
