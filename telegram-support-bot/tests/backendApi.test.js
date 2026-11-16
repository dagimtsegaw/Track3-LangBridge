import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnswer, mapAskResponse, REQUEST_TIMEOUT_MS } from '../src/services/answerService.js';
import { postEscalation } from '../src/services/humanSupportService.js';
import { t } from '../src/utils/localization.js';

test('the course ask timeout is 10 seconds', () => {
  assert.equal(REQUEST_TIMEOUT_MS, 10000);
});

test('a null course answer is not_found and an advice result is refused', () => {
  assert.deepEqual(mapAskResponse({ answer: null, sources: [], mode: 'not-found' }), {
    status: 'not_found',
    answer: null,
    sourceUrl: null,
  });
  assert.deepEqual(
    mapAskResponse({
      answer: 'Please talk to a person.',
      sources: [{ url: 'https://example.invalid/should-not-be-used' }],
      mode: 'advice',
    }),
    { status: 'refused', answer: 'Please talk to a person.', sourceUrl: null },
  );
  assert.deepEqual(
    mapAskResponse({
      answer: 'Inbox assistant.',
      sources: [{ url: 'https://example.invalid/jobs#1' }, { url: 'https://example.invalid/jobs#2' }],
      mode: 'offline',
    }),
    { status: 'answered', answer: 'Inbox assistant.', sourceUrl: 'https://example.invalid/jobs#1' },
  );
});

test('getAnswer posts to the course API and does not send the API key', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  const previousKey = process.env.BACKEND_API_KEY;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  process.env.BACKEND_API_KEY = 'secret-key-should-not-leak';
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      return {
        ok: true,
        json: async () => ({
          answer: 'From the course.',
          sources: [{ url: 'https://www.alxafrica.com/about/' }],
          mode: 'offline',
        }),
      };
    }
    return { ok: true, json: async () => ({ answer: null, sources: [], mode: 'not-found' }) };
  };

  try {
    const found = await getAnswer({ question: 'What is ALX?', language: 'am', fetchImpl });
    assert.equal(found.status, 'answered');
    assert.equal(found.answer, 'From the course.');
    assert.equal(found.sourceUrl, 'https://www.alxafrica.com/about/');
    assert.equal(calls[0].url, 'http://127.0.0.1:9/api/v1/ask');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['content-type'], 'application/json');
    assert.equal(calls[0].init.headers.authorization, undefined);
    assert.equal(calls[0].init.signal instanceof AbortSignal, true);
    assert.deepEqual(JSON.parse(calls[0].init.body), { question: 'What is ALX?', language: 'am' });
    assert.equal(calls[0].init.body.includes('secret-key-should-not-leak'), false);

    const missing = await getAnswer({ question: 'What is ALX?', language: 'en', fetchImpl });
    assert.deepEqual(missing, { status: 'not_found', answer: null, sourceUrl: null });

    const refused = await getAnswer({
      question: 'Do I need a visa?',
      language: 'en',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ answer: 'Please talk to a person.', sources: [], mode: 'advice' }),
      }),
    });
    assert.equal(refused.status, 'refused');
    assert.equal(refused.answer, 'Please talk to a person.');
  } finally {
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.BACKEND_API_KEY;
    else process.env.BACKEND_API_KEY = previousKey;
  }
});

test('a failed course ask falls back to the local FAQ', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  const previousProvider = process.env.ANSWER_PROVIDER;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  process.env.ANSWER_PROVIDER = 'local';
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const found = await getAnswer({
      question: 'What is ALX?',
      language: 'en',
      fetchImpl: async () => {
        throw new Error('down');
      },
    });
    assert.equal(found.status, 'answered');
    assert.match(found.answer, /young Africans/i);

    const unavailable = await getAnswer({
      question: 'listing vacancy',
      language: 'en',
      fallback: false,
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    assert.deepEqual(unavailable, { status: 'unavailable', answer: null, sourceUrl: null });
  } finally {
    console.warn = originalWarn;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
    if (previousProvider === undefined) delete process.env.ANSWER_PROVIDER;
    else process.env.ANSWER_PROVIDER = previousProvider;
  }
});

test('escalation posts the learner turn and reports a failed post', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9/';
  try {
    const calls = [];
    const created = await postEscalation({
      language: 'am',
      topic: 'accommodation',
      text: 'ለቃለ መጠይቄ መስተንግዶ እፈልጋለሁ',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 201, json: async () => ({ ticketId: 'db-abc' }) };
      },
    });
    assert.equal(created.ok, true);
    assert.equal(calls[0].url, 'http://127.0.0.1:9/api/v1/escalations');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      language: 'am',
      topic: 'accommodation',
      conversation: [{ role: 'learner', text: 'ለቃለ መጠይቄ መስተንግዶ እፈልጋለሁ' }],
    });
    assert.equal(calls[0].init.headers.authorization, undefined);

    const failed = await postEscalation({
      language: 'en',
      topic: 'tutor',
      text: 'hello',
      fetchImpl: async () => {
        throw new Error('down');
      },
    });
    assert.deepEqual(failed, { ok: false, reason: 'network' });
    assert.equal(t('en', 'support.wait'), 'A tutor will answer. It may take until morning.');
  } finally {
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});
