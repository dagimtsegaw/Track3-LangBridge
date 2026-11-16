import assert from 'node:assert/strict';
import test from 'node:test';
import { faqEntries } from '../src/data/data.js';
import { LANGUAGE_CODES, messages } from '../src/data/locales.js';
import { MatchStatus, matchQuestion } from '../src/services/faqService.js';
import { getAnswer } from '../src/services/answerService.js';
import { flattenMessageKeys } from '../src/utils/localization.js';
import { normalizeText } from '../src/utils/textNormalizer.js';

const SCRIPTS = {
  am: /\p{Script=Ethiopic}/u,
  ti: /\p{Script=Ethiopic}/u,
  ar: /\p{Script=Arabic}/u,
  om: /dargaggoota|sagantaa|hawaasa|deeggarsa/i,
  so: /dhalinyarada|barnaamij|bulshada|taageer/i,
};

test('every FAQ has the same verified facts in all six languages', () => {
  const ids = new Set();
  for (const entry of faqEntries) {
    assert.equal(ids.has(entry.id), false, `duplicate id ${entry.id}`);
    ids.add(entry.id);
    assert.match(entry.id, /^[a-z0-9_]+$/);
    assert.match(entry.sourceUrl, /^https:\/\/(www\.)?(alxafrica\.com|ehub\.alxafrica\.com)\//);
    for (const language of LANGUAGE_CODES) {
      assert.ok(entry.question[language]?.trim(), `${entry.id} ${language} question`);
      assert.ok(entry.answer[language]?.trim(), `${entry.id} ${language} answer`);
      assert.ok(entry.keywords[language]?.length, `${entry.id} ${language} keywords`);
      if (language !== 'en') {
        assert.notEqual(entry.answer[language], entry.answer.en, `${entry.id} ${language} is untranslated`);
      }
      assert.doesNotMatch(entry.answer[language], /\$\d|\bUSD\b|\bETB\b|2026|2027/);
    }
  }

  for (const language of LANGUAGE_CODES) {
    const seen = new Set();
    for (const entry of faqEntries) {
      const question = normalizeText(entry.question[language]);
      assert.equal(seen.has(question), false, `duplicate ${language} question: ${question}`);
      seen.add(question);
    }
  }
});

test('locale strings exist in every language', () => {
  const englishKeys = flattenMessageKeys(messages.en);
  for (const language of LANGUAGE_CODES) {
    const keys = new Set(flattenMessageKeys(messages[language]));
    for (const key of englishKeys) {
      assert.equal(keys.has(key), true, `${language} missing ${key}`);
    }
  }
});

test('matches the English question and a paraphrase', () => {
  const exact = matchQuestion('What is ALX?', 'en');
  assert.equal(exact.status, MatchStatus.ANSWERED);
  assert.equal(exact.faqId, 'what_is_alx');
  assert.match(exact.answer, /young Africans/i);

  const mission = matchQuestion('tell me the mission of alx', 'en');
  assert.equal(mission.faqId, 'alx_mission');
  assert.match(mission.answer, /expanding career and entrepreneurial opportunity/i);
});

test('matches Amharic questions and returns the Amharic answer', () => {
  const entry = faqEntries.find((item) => item.id === 'what_is_alx');
  const exact = matchQuestion(entry.question.am, 'am');
  assert.equal(exact.faqId, 'what_is_alx');
  assert.equal(exact.answer, entry.answer.am);
  assert.match(exact.answer, SCRIPTS.am);

  const paraphrase = matchQuestion('እባክህ ስለ alx ንገረኝ', 'am');
  assert.equal(paraphrase.faqId, 'what_is_alx');
  assert.equal(paraphrase.answer, entry.answer.am);
});

test('matches Afaan Oromo questions and returns the Oromo answer', () => {
  const entry = faqEntries.find((item) => item.id === 'what_is_alx');
  const exact = matchQuestion(entry.question.om, 'om');
  assert.equal(exact.faqId, 'what_is_alx');
  assert.equal(exact.answer, entry.answer.om);
  assert.match(exact.answer, SCRIPTS.om);

  const paraphrase = matchQuestion("maaloo waa'ee alx naaf himi", 'om');
  assert.equal(paraphrase.faqId, 'what_is_alx');
});

test('matches Tigrinya questions and returns the Tigrinya answer', () => {
  const entry = faqEntries.find((item) => item.id === 'alx_mission');
  const exact = matchQuestion(entry.question.ti, 'ti');
  assert.equal(exact.faqId, 'alx_mission');
  assert.equal(exact.answer, entry.answer.ti);
  assert.match(exact.answer, SCRIPTS.ti);
});

test('matches Somali questions and returns the Somali answer', () => {
  const entry = faqEntries.find((item) => item.id === 'what_is_alx');
  const exact = matchQuestion(entry.question.so, 'so');
  assert.equal(exact.faqId, 'what_is_alx');
  assert.equal(exact.answer, entry.answer.so);
  assert.match(exact.answer, SCRIPTS.so);

  const paraphrase = matchQuestion('fadlan ii sheeg ku saabsan alx', 'so');
  assert.equal(paraphrase.faqId, 'what_is_alx');
});

test('matches Arabic questions and returns the Arabic answer', () => {
  const entry = faqEntries.find((item) => item.id === 'what_is_alx');
  const exact = matchQuestion('ما هى ALX', 'ar');
  assert.equal(exact.faqId, 'what_is_alx');
  assert.equal(exact.answer, entry.answer.ar);
  assert.match(exact.answer, SCRIPTS.ar);

  const paraphrase = matchQuestion('اريد ان اعرف عن منظمة alx', 'ar');
  assert.equal(paraphrase.faqId, 'what_is_alx');
});

test('every predefined question matches its own entry in every language', () => {
  for (const entry of faqEntries) {
    for (const language of LANGUAGE_CODES) {
      const result = matchQuestion(entry.question[language], language);
      assert.equal(result.status, MatchStatus.ANSWERED, `${language} ${entry.id}`);
      assert.equal(result.faqId, entry.id, `${language} ${entry.id} matched ${result.faqId}`);
      assert.equal(result.answer, entry.answer[language]);
    }
  }
});

test('unknown, weak, and ambiguous questions do not invent an answer', () => {
  for (const question of [
    'What is the weather in Nairobi tomorrow?',
    'How much is the ALX tuition and scholarship?',
    'hello',
    'career',
    'support',
    'please guarantee me a job and a salary',
  ]) {
    const result = matchQuestion(question, 'en');
    assert.equal(result.status, MatchStatus.NOT_FOUND, question);
    assert.equal(result.answer, null);
    assert.equal(result.sourceUrl, null);
  }
});

test('an empty course API URL stays on the local FAQ', async () => {
  const previousProvider = process.env.ANSWER_PROVIDER;
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  const previousKey = process.env.BACKEND_API_KEY;
  process.env.ANSWER_PROVIDER = 'local';
  delete process.env.BACKEND_API_BASE_URL;
  process.env.BACKEND_API_KEY = 'secret-key-should-not-leak';

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error('network should not be used');
  };

  try {
    const found = await getAnswer({ question: 'What is ALX?', language: 'en' });
    assert.equal(found.status, 'answered');
    assert.match(found.answer, /young Africans/i);
    assert.equal(calls.length, 0);
    assert.equal(JSON.stringify(found).includes('secret-key-should-not-leak'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousProvider === undefined) delete process.env.ANSWER_PROVIDER;
    else process.env.ANSWER_PROVIDER = previousProvider;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.BACKEND_API_KEY;
    else process.env.BACKEND_API_KEY = previousKey;
  }
});
