import { config } from '../config.js';
import { findLocalAnswer } from './faqService.js';
import { askGemini, couldNotFind, isGreeting, knowledgeSections, selectContext } from './geminiGrounded.js';
import { t } from '../utils/localization.js';

export const REQUEST_TIMEOUT_MS = 10_000;

let warnedAboutBackend = false;
let warnedAboutGemini = false;

function noteUnusedBackendProvider() {
  const requested = config.answerProvider;
  if (!requested || requested === 'local' || requested === 'gemini' || warnedAboutBackend) {
    return;
  }
  warnedAboutBackend = true;
  console.warn(
    `ANSWER_PROVIDER "${requested}" is not connected. Using local FAQ data until that provider exists.`,
  );
}

function courseApiUrl(path) {
  const base = config.backendApiBaseUrl.replace(/\/+$/, '');
  return `${base}${path}`;
}

function firstSourceUrl(body) {
  const url = body && body.sources && body.sources[0] && body.sources[0].url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export function mapAskResponse(body) {
  if (body && body.mode === 'advice') {
    const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
    return { status: 'refused', answer: answer || null, sourceUrl: null };
  }
  const answer = body && typeof body.answer === 'string' ? body.answer.trim() : '';
  if (answer) {
    return { status: 'answered', answer, sourceUrl: firstSourceUrl(body) };
  }
  return { status: 'not_found', answer: null, sourceUrl: null };
}

async function askCourseApi({ question, language, fetchImpl }) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const response = await fetchFn(courseApiUrl('/api/v1/ask'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, language }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error('course ask failed');
  }
  return mapAskResponse(await response.json());
}

async function localAnswer({ question, language, fetchImpl }) {
  if (isGreeting(question)) {
    return { status: 'answered', answer: t(language, 'greeting'), sourceUrl: null };
  }

  const local = findLocalAnswer(question, language);
  if (config.answerProvider !== 'gemini' || !config.geminiKey) {
    if (config.answerProvider === 'gemini' && !config.geminiKey && !warnedAboutGemini) {
      warnedAboutGemini = true;
      console.warn('GEMINI_API_KEY is empty. Using the local FAQ.');
    }
    noteUnusedBackendProvider();
    return local;
  }

  const focused = selectContext(question, language);
  const sections = knowledgeSections(language);
  if (!sections.length) {
    return { status: 'not_found', answer: null, sourceUrl: null };
  }

  try {
    const text = await askGemini({
      question,
      language,
      sections,
      fetchImpl,
      key: config.geminiKey,
      model: config.geminiModel,
    });
    if (couldNotFind(text)) {
      return { status: 'not_found', answer: null, sourceUrl: null };
    }
    return {
      status: 'answered',
      answer: text,
      sourceUrl: focused[0]?.url || null,
    };
  } catch {
    console.warn('Gemini did not answer. Using the local FAQ when it has a match.');
    return local;
  }
}

/**
 * When BACKEND_API_BASE_URL is set, the course API is the answer.
 * A null answer stays not_found. The handler shows the course sentence and a person button.
 * mode "advice" is the API refusal. A thrown request, timeout, or non-OK status uses the local path.
 * BACKEND_API_KEY is not sent.
 */
export async function getAnswer({ question, language, fetchImpl, fallback = true }) {
  if (config.backendApiBaseUrl) {
    try {
      return await askCourseApi({ question, language, fetchImpl });
    } catch {
      if (!fallback) {
        return { status: 'unavailable', answer: null, sourceUrl: null };
      }
      console.warn('Course API did not answer. Using the local FAQ.');
    }
  } else if (!fallback) {
    return { status: 'unavailable', answer: null, sourceUrl: null };
  }
  return localAnswer({ question, language, fetchImpl });
}
