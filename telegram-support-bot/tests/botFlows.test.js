import assert from 'node:assert/strict';
import test from 'node:test';
import { handleModeCallback } from '../src/handlers/accessHandler.js';
import { handleLanguageCallback } from '../src/handlers/languageHandler.js';
import { handleMenuCallback, showJobAlerts } from '../src/handlers/menuHandler.js';
import { handleFaqCallback } from '../src/handlers/faqHandler.js';
import { handleIncomingText } from '../src/handlers/messageHandler.js';
import { beginHumanSupport, handleReplyCommand } from '../src/handlers/humanSupportHandler.js';
import { handleStart } from '../src/handlers/startHandler.js';
import { mainMenuKeyboard } from '../src/keyboards/keyboards.js';
import { buildSupportMessage } from '../src/services/humanSupportService.js';
import { speech } from '../src/services/speechService.js';
import { resetGuards } from '../src/utils/guards.js';
import { t } from '../src/utils/localization.js';

process.env.ANSWER_PROVIDER = 'local';

function createCtx(overrides = {}) {
  const ctx = {
    from: { id: 42, first_name: 'Ada', username: 'ada', is_bot: false },
    chat: { id: 42, type: 'private' },
    session: {
      language: null,
      pendingQuestion: null,
      awaitingFreeText: false,
      awaitingHumanQuestion: false,
    },
    state: {},
    message: undefined,
    callbackQuery: undefined,
    sent: [],
    replies: [],
    edits: [],
    acked: false,
    async answerCbQuery() {
      ctx.acked = true;
    },
    async reply(text, extra) {
      ctx.replies.push({ text, extra });
    },
    async editMessageText(text, extra) {
      ctx.edits.push({ text, extra });
    },
    telegram: {
      async sendMessage(chatId, text) {
        ctx.sent.push({ chatId, text });
      },
    },
  };
  Object.assign(ctx, overrides);
  return ctx;
}

test('language selection stores the language and asks how to receive answers', async () => {
  const ctx = createCtx({
    callbackQuery: { data: 'lang:am', message: { message_id: 1 } },
  });
  await handleLanguageCallback(ctx);
  assert.equal(ctx.session.language, 'am');
  assert.equal(ctx.session.chooseModeThen, 'welcome');
  assert.equal(ctx.acked, true);
  assert.match(ctx.edits[0].text, /መልሱን/);
  assert.equal(ctx.edits[0].text.includes('\u202B'), false);
  const callbacks = ctx.edits[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(callbacks, ['mode:std', 'mode:blind', 'mode:deaf']);
});

test('Arabic mode prompt is marked for right-to-left display', async () => {
  const ctx = createCtx({
    callbackQuery: { data: 'lang:ar', message: { message_id: 2 } },
  });
  await handleLanguageCallback(ctx);
  assert.equal(ctx.session.language, 'ar');
  assert.equal(ctx.edits[0].text.startsWith('\u202B'), true);
  assert.match(ctx.edits[0].text, /كيف أرسل/);
});

test('main menu labels are translated and FAQ navigation reaches an answer', async () => {
  const english = mainMenuKeyboard('en').reply_markup.inline_keyboard.flat().map((button) => button.text);
  const somali = mainMenuKeyboard('so').reply_markup.inline_keyboard.flat().map((button) => button.text);
  assert.notDeepEqual(english, somali);

  const ctx = createCtx({
    session: { language: 'am', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    callbackQuery: { data: 'menu:faq', message: { message_id: 3 } },
  });
  await handleMenuCallback(ctx);
  const callbacks = ctx.edits.at(-1).extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes('faq:cat:about'));

  ctx.callbackQuery = { data: 'faq:cat:about', message: { message_id: 3 } };
  ctx.state = {};
  await handleFaqCallback(ctx);
  const questionCallbacks = ctx.edits.at(-1).extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(questionCallbacks.includes('faq:q:what_is_alx'));

  ctx.callbackQuery = { data: 'faq:q:what_is_alx', message: { message_id: 3 } };
  ctx.state = {};
  await handleFaqCallback(ctx);
  assert.match(ctx.replies.at(-1).text, /ወጣት አፍሪካውያን/);
  assert.match(ctx.replies.at(-1).text, /https:\/\/www\.alxafrica\.com\/about\//);
  const after = ctx.replies.at(-1).extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(after.includes('nav:menu'));
  assert.ok(after.includes('nav:ask'));
  assert.ok(after.includes('menu:human'));
});

test('a typed question can match an FAQ in the selected language', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  delete process.env.BACKEND_API_BASE_URL;
  const ctx = createCtx({
    session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: 'What is Founder Academy?' },
  });
  try {
    await handleIncomingText(ctx);
    assert.match(ctx.replies[0].text, /venture/i);
    assert.match(ctx.replies[0].text, /founder-academy/);
    assert.equal(ctx.session.pendingQuestion, null);
  } finally {
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('an unmatched question offers human help and keeps the question', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  delete process.env.BACKEND_API_BASE_URL;
  const ctx = createCtx({
    session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: 'What is the weather in Nairobi tomorrow?' },
  });
  try {
    await handleIncomingText(ctx);
    assert.match(ctx.replies[0].text, /I could not find this in the course\./);
    const labels = ctx.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.text);
    assert.ok(labels.includes('👤 Talk to a person'));
    assert.equal(ctx.session.pendingQuestion, 'What is the weather in Nairobi tomorrow?');
    const callbacks = ctx.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
    assert.ok(callbacks.includes('human:transfer'));
    assert.ok(callbacks.includes('menu:faq'));
    assert.ok(callbacks.includes('nav:menu'));
  } finally {
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('human escalation explains the gap when no support chat is configured', async () => {
  const previous = process.env.HUMAN_SUPPORT_CHAT_ID;
  delete process.env.HUMAN_SUPPORT_CHAT_ID;
  const ctx = createCtx({
    session: {
      language: 'en',
      pendingQuestion: 'What is the weather in Nairobi tomorrow?',
      awaitingFreeText: false,
      awaitingHumanQuestion: false,
    },
    callbackQuery: { data: 'human:transfer', message: { message_id: 9 } },
  });
  await beginHumanSupport(ctx);
  assert.equal(ctx.sent.length, 0);
  assert.match(ctx.edits.at(-1).text, /not connected/i);
  assert.match(ctx.edits.at(-1).text, /ehub\.alxafrica\.com/);
  assert.doesNotMatch(ctx.edits.at(-1).text, /ALX representative has received/i);
  if (previous === undefined) delete process.env.HUMAN_SUPPORT_CHAT_ID;
  else process.env.HUMAN_SUPPORT_CHAT_ID = previous;
});

test('human escalation forwards only after the support chat accepts the message', async () => {
  const previous = process.env.HUMAN_SUPPORT_CHAT_ID;
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.HUMAN_SUPPORT_CHAT_ID = '-100123';
  delete process.env.BACKEND_API_BASE_URL;
  const ctx = createCtx({
    session: {
      language: 'so',
      pendingQuestion: 'Su’aalahayga ma jirto',
      awaitingFreeText: false,
      awaitingHumanQuestion: false,
    },
    callbackQuery: { data: 'human:transfer', message: { message_id: 10 } },
  });
  await beginHumanSupport(ctx);
  assert.equal(ctx.sent.length, 1);
  assert.equal(String(ctx.sent[0].chatId), '-100123');
  assert.match(ctx.sent[0].text, /Ada/);
  assert.match(ctx.sent[0].text, /@ada/);
  assert.match(ctx.sent[0].text, /User ID: 42/);
  assert.match(ctx.sent[0].text, /Somali \(so\)/);
  assert.match(ctx.sent[0].text, /Su’aalahayga ma jirto/);
  assert.match(ctx.sent[0].text, /Time \(UTC\):/);
  assert.equal(ctx.sent[0].text.includes('BOT_TOKEN'), false);
  assert.match(ctx.edits.at(-1).text, /Telegram/);
  assert.equal(ctx.session.pendingQuestion, null);
  if (previous === undefined) delete process.env.HUMAN_SUPPORT_CHAT_ID;
  else process.env.HUMAN_SUPPORT_CHAT_ID = previous;
  if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
  else process.env.BACKEND_API_BASE_URL = previousUrl;
});

test('a failed support send is not described as delivered', async () => {
  const previous = process.env.HUMAN_SUPPORT_CHAT_ID;
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.HUMAN_SUPPORT_CHAT_ID = '-100123';
  delete process.env.BACKEND_API_BASE_URL;
  const ctx = createCtx({
    session: {
      language: 'en',
      pendingQuestion: 'Need a person',
      awaitingFreeText: false,
      awaitingHumanQuestion: false,
    },
  });
  ctx.telegram.sendMessage = async () => {
    const error = new Error('Forbidden');
    error.response = { error_code: 403, description: 'Forbidden' };
    throw error;
  };
  await beginHumanSupport(ctx);
  assert.match(ctx.replies.at(-1).text, /could not forward/i);
  assert.equal(ctx.session.pendingQuestion, 'Need a person');
  if (previous === undefined) delete process.env.HUMAN_SUPPORT_CHAT_ID;
  else process.env.HUMAN_SUPPORT_CHAT_ID = previous;
  if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
  else process.env.BACKEND_API_BASE_URL = previousUrl;
});

test('only configured admins can use /reply', async () => {
  const previous = process.env.ADMIN_TELEGRAM_IDS;
  process.env.ADMIN_TELEGRAM_IDS = '7';
  const learner = createCtx({
    session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: '/reply 42 Hello from staff' },
  });
  await handleReplyCommand(learner);
  assert.match(learner.replies[0].text, /cannot use/i);
  assert.equal(learner.sent.length, 0);

  process.env.ADMIN_TELEGRAM_IDS = '42';
  const admin = createCtx({
    session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: '/reply 99 Your question was received by the support chat.' },
  });
  await handleReplyCommand(admin);
  assert.equal(String(admin.sent[0].chatId), '99');
  assert.match(admin.sent[0].text, /support chat/);
  assert.match(admin.sent[0].text, /Your question was received/);
  assert.match(admin.replies.at(-1).text, /reply was sent/i);
  if (previous === undefined) delete process.env.ADMIN_TELEGRAM_IDS;
  else process.env.ADMIN_TELEGRAM_IDS = previous;
});

test('support messages include the required learner details', () => {
  const message = buildSupportMessage({
    firstName: 'Ada',
    username: '',
    userId: 42,
    language: 'ti',
    question: 'ሕቶ',
    requestedAt: new Date('2026-11-14T08:00:00.000Z'),
  });
  assert.match(message, /Name: Ada/);
  assert.match(message, /Username: not available/);
  assert.match(message, /User ID: 42/);
  assert.match(message, /Tigrinya \(ti\)/);
  assert.match(message, /ሕቶ/);
  assert.match(message, /2026-11-14T08:00:00.000Z/);
});

test('changing language asks for the answer mode in the new language', async () => {
  resetGuards();
  const ctx = createCtx({
    session: { language: 'en', pendingQuestion: 'old', awaitingFreeText: true, awaitingHumanQuestion: true },
    callbackQuery: { data: 'lang:om', message: { message_id: 4 } },
  });
  await handleLanguageCallback(ctx);
  assert.equal(ctx.session.language, 'om');
  assert.equal(ctx.session.awaitingFreeText, false);
  assert.match(ctx.edits[0].text, /Deebii akkamitti/);
});

test('blind mode welcomes the learner and sends the same words as audio', async () => {
  const original = speech.speak;
  const spoken = [];
  speech.speak = async (text, language) => {
    spoken.push({ text, language });
    return Buffer.from('audio');
  };
  const ctx = createCtx({
    session: { language: 'am', mode: null, chooseModeThen: 'welcome', lastSpoken: null },
    callbackQuery: { data: 'mode:blind', message: { message_id: 5 } },
  });
  ctx.audio = [];
  ctx.replyWithAudio = async (file) => {
    ctx.audio.push(file);
  };
  try {
    await handleModeCallback(ctx);
    assert.equal(ctx.session.mode, 'blind');
    assert.match(ctx.edits[0].text, /እንኳን/);
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].language, 'am');
    assert.match(spoken[0].text, /እንኳን/);
    assert.equal(ctx.audio.length, 1);
    assert.equal(ctx.audio[0].filename, 'answer.mp3');
  } finally {
    speech.speak = original;
  }
});

test('a blind learner hears a typed answer, and a deaf learner does not', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  delete process.env.BACKEND_API_BASE_URL;
  const original = speech.speak;
  const calls = [];
  speech.speak = async (text, language) => {
    calls.push(language);
    assert.match(text, /venture/i);
    return Buffer.from('audio');
  };
  const blind = createCtx({
    session: { language: 'en', mode: 'blind', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: 'What is Founder Academy?' },
  });
  blind.audio = [];
  blind.replyWithAudio = async (file) => {
    blind.audio.push(file);
  };
  const deaf = createCtx({
    session: { language: 'en', mode: 'deaf', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    message: { text: 'What is Founder Academy?' },
  });
  deaf.replyWithAudio = async () => {
    throw new Error('deaf mode must not send audio');
  };
  try {
    await handleIncomingText(blind);
    assert.equal(blind.audio.length, 1);
    const listen = blind.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
    assert.ok(listen.includes('voice:speak'));

    await handleIncomingText(deaf);
    assert.equal(calls.length, 1);
    const callbacks = deaf.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
    assert.equal(callbacks.includes('voice:speak'), false);
  } finally {
    speech.speak = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('a start payload opens the main menu and accommodation opens a ticket', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  const previousChat = process.env.HUMAN_SUPPORT_CHAT_ID;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  delete process.env.HUMAN_SUPPORT_CHAT_ID;
  const posts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 201, json: async () => ({ ticketId: 'db-room' }) };
  };
  try {
    const tutor = createCtx({ startPayload: 'am_tutor' });
    await handleStart(tutor);
    assert.equal(tutor.session.language, 'am');
    assert.equal(tutor.session.topic, 'tutor');
    assert.match(tutor.replies[0].text, /ዋና ምናሌ/);
    assert.equal(posts.length, 0);

    const bad = createCtx({ startPayload: 'xx_alerts' });
    await handleStart(bad);
    assert.match(bad.replies[0].text, /Choose your language/);

    const room = createCtx({ startPayload: 'en_accommodation' });
    await handleStart(room);
    assert.equal(room.session.topic, 'accommodation');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, 'http://127.0.0.1:9/api/v1/escalations');
    assert.equal(posts[0].body.topic, 'accommodation');
    assert.deepEqual(posts[0].body.conversation, [
      { role: 'learner', text: 'I need an accommodation for my interview' },
    ]);
    assert.match(room.replies.at(-1).text, /A tutor will answer\. It may take until morning\./);
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
    if (previousChat === undefined) delete process.env.HUMAN_SUPPORT_CHAT_ID;
    else process.env.HUMAN_SUPPORT_CHAT_ID = previousChat;
  }
});

test('a null course answer offers a person and does not use the local FAQ', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ answer: null, sources: [], mode: 'not-found' }),
  });
  try {
    const ctx = createCtx({
      session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
      message: { text: 'What is ALX?' },
    });
    await handleIncomingText(ctx);
    assert.match(ctx.replies[0].text, /I could not find this in the course\./);
    assert.doesNotMatch(ctx.replies[0].text, /young Africans/);
    const callbacks = ctx.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
    assert.ok(callbacks.includes('human:transfer'));
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('advice from the course API is the refusal sentence and points to a person', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).question, 'Do I need a visa?');
    return {
      ok: true,
      json: async () => ({ answer: 'Please talk to a person.', sources: [], mode: 'advice' }),
    };
  };
  try {
    const ctx = createCtx({
      session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
      message: { text: 'Do I need a visa?' },
    });
    await handleIncomingText(ctx);
    assert.match(ctx.replies[0].text, /Please talk to a person\./);
    assert.equal(ctx.session.pendingQuestion, 'Do I need a visa?');
    const callbacks = ctx.replies[0].extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
    assert.ok(callbacks.includes('human:transfer'));
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('job listings ask the course API and say push alerts are not built', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  delete process.env.BACKEND_API_BASE_URL;
  const ctx = createCtx({
    session: { language: 'en', pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
  });
  await showJobAlerts(ctx);
  assert.match(ctx.replies[0].text, /not configured/i);
  assert.match(ctx.replies[0].text, /Automatic push alerts are not built/);

  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.language, 'so');
    assert.equal(body.question, t('so', 'alerts.question'));
    return {
      ok: true,
      json: async () => ({
        answer: 'Test listing: Inbox assistant.',
        sources: [{ url: 'http://127.0.0.1:3000/demo/data/jobs.json#test-job-inbox' }],
        mode: 'offline',
      }),
    };
  };
  try {
    const so = createCtx({
      session: { language: 'so', topic: null, pendingQuestion: null, awaitingFreeText: false, awaitingHumanQuestion: false },
    });
    await showJobAlerts(so);
    assert.equal(so.session.topic, 'alerts');
    assert.match(so.replies[0].text, /Inbox assistant/);
    assert.match(so.replies[0].text, /jobs\.json#test-job-inbox/);
    assert.match(so.replies[0].text, /Digniinaha iskaa loo riixo lama dhisin/);
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
  }
});

test('a failed course ticket says so and still uses the widget wait sentence', async () => {
  const previousUrl = process.env.BACKEND_API_BASE_URL;
  const previousChat = process.env.HUMAN_SUPPORT_CHAT_ID;
  process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:9';
  process.env.HUMAN_SUPPORT_CHAT_ID = '-100123';
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('down');
  };
  try {
    const ctx = createCtx({
      session: {
        language: 'en',
        topic: 'tutor',
        pendingQuestion: 'Need a person',
        awaitingFreeText: false,
        awaitingHumanQuestion: false,
      },
    });
    await beginHumanSupport(ctx);
    assert.equal(ctx.sent.length, 1);
    assert.match(ctx.sent[0].text, /Need a person/);
    assert.match(ctx.replies.at(-1).text, /could not send your message to the course assistant/i);
    assert.match(ctx.replies.at(-1).text, /A tutor will answer\. It may take until morning\./);
    assert.match(ctx.replies.at(-1).text, /Telegram/);
    assert.equal(ctx.session.pendingQuestion, null);
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.BACKEND_API_BASE_URL;
    else process.env.BACKEND_API_BASE_URL = previousUrl;
    if (previousChat === undefined) delete process.env.HUMAN_SUPPORT_CHAT_ID;
    else process.env.HUMAN_SUPPORT_CHAT_ID = previousChat;
  }
});
