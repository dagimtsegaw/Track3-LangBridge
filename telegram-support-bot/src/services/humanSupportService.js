import { config } from '../config.js';
import { LANGUAGE_NAMES } from '../data/locales.js';
import { REQUEST_TIMEOUT_MS } from './answerService.js';

const recentLearners = new Map();

export function isAdmin(userId) {
  return config.adminTelegramIds.includes(String(userId));
}

export function rememberLearner(userId, details) {
  recentLearners.set(String(userId), details);
  if (recentLearners.size > 1000) {
    const oldest = recentLearners.keys().next().value;
    recentLearners.delete(oldest);
  }
}

export function recallLearner(userId) {
  return recentLearners.get(String(userId)) || null;
}

function oneLine(value, fallback) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return text || fallback;
}

export function buildSupportMessage({ firstName, username, userId, language, question, requestedAt }) {
  const when = requestedAt instanceof Date ? requestedAt.toISOString() : new Date(requestedAt).toISOString();
  return [
    'New learner support request',
    `Name: ${oneLine(firstName, 'not available')}`,
    `Username: ${username ? `@${oneLine(username, 'not available')}` : 'not available'}`,
    `User ID: ${oneLine(userId, 'not available')}`,
    `Language: ${LANGUAGE_NAMES[language] || language || 'unknown'} (${language || 'unknown'})`,
    `Question: ${oneLine(question, 'not available')}`,
    `Time (UTC): ${when}`,
  ].join('\n');
}

export async function postEscalation({ language, topic, text, fetchImpl }) {
  const base = config.backendApiBaseUrl.replace(/\/+$/, '');
  if (!base) {
    return { ok: false, reason: 'not_configured' };
  }
  const safeTopic = /^(tutor|careers|alerts|accommodation)$/.test(String(topic || ''))
    ? String(topic)
    : 'tutor';
  try {
    const fetchFn = fetchImpl || globalThis.fetch;
    const response = await fetchFn(`${base}/api/v1/escalations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language,
        topic: safeTopic,
        conversation: [{ role: 'learner', text: String(text || '') }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, reason: 'http' };
    }
    return { ok: true, reason: 'created' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export async function forwardSupportRequest(telegram, details, options = {}) {
  const chatId = options.chatId ?? config.humanSupportChatId;
  const message = buildSupportMessage(details);
  const ticket = await postEscalation({
    language: details.language,
    topic: options.topic,
    text: details.question,
    fetchImpl: options.fetchImpl,
  });

  if (!chatId) {
    return {
      delivered: false,
      reason: 'not_configured',
      message,
      ticketPosted: ticket.ok,
      ticketReason: ticket.reason,
    };
  }

  try {
    await telegram.sendMessage(chatId, message);
    rememberLearner(details.userId, {
      language: details.language,
      question: details.question,
      at: details.requestedAt,
    });
    return {
      delivered: true,
      reason: 'sent',
      message,
      ticketPosted: ticket.ok,
      ticketReason: ticket.reason,
    };
  } catch (error) {
    return {
      delivered: false,
      reason: 'send_failed',
      message,
      errorCode: error?.response?.error_code || null,
      ticketPosted: ticket.ok,
      ticketReason: ticket.reason,
    };
  }
}

export async function sendStaffReply(telegram, chatId, text) {
  await telegram.sendMessage(chatId, text);
}
