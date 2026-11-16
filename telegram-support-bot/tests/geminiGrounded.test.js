import assert from 'node:assert/strict';
import test from 'node:test';
import { COULD_NOT_FIND, couldNotFind, isGreeting, knowledgeSections, selectContext } from '../src/services/geminiGrounded.js';
import { getAnswer } from '../src/services/answerService.js';

test('selects the FAQ entry and the extra site page, and skips an outside question', () => {
  const about = selectContext('What is ALX?', 'en');
  assert.equal(about[0].id, 'what_is_alx');

  const chair = selectContext('What are the CHAIR values?', 'en');
  assert.ok(chair.some((section) => section.id === 'chair_values'));

  const weeks = selectContext('How many weeks is Data Analytics?', 'en');
  assert.ok(weeks.some((section) => section.id === 'data_analytics_shape' || section.id === 'programme_data_analytics'));

  assert.deepEqual(selectContext('What is the weather in Nairobi tomorrow?', 'en'), []);
  assert.deepEqual(selectContext('career', 'en'), []);
  assert.equal(isGreeting('helo'), true);
  assert.equal(isGreeting('hello there'), true);
  assert.equal(isGreeting('ሰላም'), true);
  assert.equal(isGreeting('hello what is alx'), false);
  assert.ok(knowledgeSections('en').some((section) => section.id === 'what_is_alx' && /young Africans/i.test(section.text)));
});

test('a Gemini miss is treated as not found', () => {
  assert.equal(couldNotFind(''), true);
  assert.equal(couldNotFind(COULD_NOT_FIND), true);
  assert.equal(couldNotFind('ALX equips young Africans through programmes.'), false);
});

test('gemini answers from the selected sections and says it could not find an outside question', async () => {
  const previousProvider = process.env.ANSWER_PROVIDER;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.ANSWER_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'test-key-should-not-leak';
  process.env.GEMINI_MODEL = 'fake-model';
  delete process.env.BACKEND_API_BASE_URL;

  const calls = [];
  const fetchImpl = async (_url, opts) => {
    calls.push(opts.body);
    const question = JSON.parse(opts.body).contents[0].parts[0].text;
    const text = question.includes('weather')
      ? COULD_NOT_FIND
      : 'ALX equips young Africans through programmes it describes as rigorous and affordable.';
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    };
  };

  try {
    const found = await getAnswer({ question: 'What is ALX?', language: 'en', fetchImpl });
    assert.equal(found.status, 'answered');
    assert.match(found.answer, /young Africans/i);
    assert.equal(found.sourceUrl, 'https://www.alxafrica.com/about/');
    assert.equal(calls.length, 1);
    assert.match(calls[0], /young Africans/);
    assert.equal(calls[0].includes('test-key-should-not-leak'), false);

    const hello = await getAnswer({ question: 'helo', language: 'en', fetchImpl });
    assert.equal(hello.status, 'answered');
    assert.match(hello.answer, /What can I help you with/i);
    assert.equal(calls.length, 1);

    const typo = await getAnswer({ question: 'wht is alx', language: 'en', fetchImpl });
    assert.equal(typo.status, 'answered');
    assert.match(typo.answer, /young Africans/i);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /equips young Africans/);

    const missing = await getAnswer({
      question: 'What is the weather in Nairobi tomorrow?',
      language: 'en',
      fetchImpl,
    });
    assert.deepEqual(missing, { status: 'not_found', answer: null, sourceUrl: null });
    assert.equal(calls.length, 3);
  } finally {
    if (previousProvider === undefined) delete process.env.ANSWER_PROVIDER;
    else process.env.ANSWER_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});
