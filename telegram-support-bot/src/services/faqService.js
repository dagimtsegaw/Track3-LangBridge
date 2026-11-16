import Fuse from 'fuse.js';
import { faqEntries } from '../data/data.js';
import { normalizeText, tokenize } from '../utils/textNormalizer.js';

export const MatchStatus = {
  ANSWERED: 'answered',
  NOT_FOUND: 'not_found',
};

const LANGUAGES = ['en', 'am', 'om', 'ti', 'so', 'ar'];
const CONFIDENT_SCORE = 0.8;
const AMBIGUITY_GAP = 0.07;

const STOPWORDS = {
  en: new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'at', 'my', 'me', 'i', 'you', 'your', 'what', 'whats', 'who', 'how', 'where', 'when', 'why', 'does', 'do', 'did', 'can', 'could', 'please', 'tell', 'about', 'with', 'from', 'that', 'this', 'it', 'its', 'have', 'has', 'want', 'like', 'there', 'any', 'more']),
  am: new Set(['ምንድን', 'ነው', 'ምንድነው', 'እና', 'ውስጥ', 'ላይ', 'እንዴት', 'የት', 'ማን', 'ምን', 'ይህ', 'ስለ', 'ወደ', 'እባክህ', 'እባክዎ', 'ንገረኝ', 'ልንገረኝ']),
  om: new Set(['maali', 'maal', 'eenyu', 'eessa', 'akkamitti', 'attamitti', 'fi', 'kan', 'kun', 'sun', 'ykn', 'akka', 'irraa', 'keessa', 'waaee', 'isaa', 'ani', 'si', 'maaloo', 'naaf', 'himi']),
  ti: new Set(['እንታይ', 'እዩ', 'እያ', 'ኣብ', 'ምስ', 'ከም', 'እዚ', 'ብዛዕባ', 'ናብ', 'ካብ', 'ድዩ', 'በጃኹም']),
  so: new Set(['waa', 'maxay', 'maxaa', 'yaa', 'ayaa', 'ee', 'iyo', 'ama', 'ku', 'ka', 'ah', 'ma', 'halkee', 'sidee', 'fadlan', 'ii', 'sheeg', 'saabsan', 'oo']),
  ar: new Set(['ما', 'هي', 'هو', 'ماذا', 'من', 'اين', 'أين', 'كيف', 'هل', 'في', 'على', 'عن', 'الي', 'إلى', 'الى', 'او', 'أو', 'و', 'هذا', 'هذه', 'التي', 'الذي', 'لا', 'لم', 'اريد', 'أريد', 'ان', 'أن', 'اعرف']),
};

const GENERIC = new Set([
  'alx',
  'programme',
  'program',
  'programmes',
  'programs',
  'career',
  'course',
  'courses',
  'academy',
]);

const fuseCache = new Map();

function distinctiveTokens(text, language) {
  const stops = STOPWORDS[language] || STOPWORDS.en;
  return tokenize(text).filter((token) => !stops.has(token) && !/^\d+$/.test(token));
}

function getFuse(language) {
  if (!fuseCache.has(language)) {
    const documents = faqEntries.map((item) => ({
      id: item.id,
      question: normalizeText(item.question[language] || ''),
      keywords: (item.keywords[language] || []).map((keyword) => normalizeText(keyword)).join('\n'),
    }));
    fuseCache.set(
      language,
      new Fuse(documents, {
        keys: [
          { name: 'question', weight: 0.65 },
          { name: 'keywords', weight: 0.35 },
        ],
        includeScore: true,
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: 3,
      }),
    );
  }
  return fuseCache.get(language);
}

function fuseScores(query, language) {
  const scores = new Map();
  for (const hit of getFuse(language).search(query)) {
    scores.set(hit.item.id, 1 - hit.score);
  }
  return scores;
}

function scoreEntry(query, queryTokens, item, language, fuzzy) {
  const question = normalizeText(item.question[language] || '');
  if (question && question === query) {
    return 1;
  }

  const phrases = [question, ...(item.keywords[language] || []).map((keyword) => normalizeText(keyword))]
    .filter((phrase) => phrase.length >= 4);

  let lexical = 0;
  for (const phrase of phrases) {
    if (query.includes(phrase)) {
      lexical = Math.max(lexical, Math.min(0.97, 0.78 + phrase.length / 120));
    }
  }

  const entryTokens = distinctiveTokens([question, ...(item.keywords[language] || [])].join(' '), language);
  const entryTokenSet = new Set(entryTokens);
  const matched = queryTokens.filter((token) => entryTokenSet.has(token));
  const specific = matched.filter((token) => !GENERIC.has(token));
  const coverage = queryTokens.length ? matched.length / queryTokens.length : 0;

  if (specific.length >= 2 && coverage >= 0.6) {
    lexical = Math.max(lexical, Math.min(0.95, 0.78 + coverage * 0.16));
  } else if (specific.length === 1 && matched.length >= 2 && coverage >= 0.67) {
    lexical = Math.max(lexical, 0.84);
  } else if (specific.length === 1 && specific[0].length >= 6 && coverage === 1 && queryTokens.length === 1) {
    lexical = Math.max(lexical, 0.86);
  }

  if (fuzzy >= 0.8 && queryTokens.length >= 2 && specific.length >= 1 && coverage >= 0.34) {
    lexical = Math.max(lexical, Math.min(0.9, fuzzy));
  }

  return lexical;
}

function notFound(score = 0) {
  return {
    status: MatchStatus.NOT_FOUND,
    faqId: null,
    score,
    answer: null,
    sourceUrl: null,
  };
}

export function matchQuestion(rawQuestion, language) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const query = normalizeText(rawQuestion);
  if (query.length < 3) {
    return notFound();
  }

  const queryTokens = distinctiveTokens(query, lang);
  const fuzzy = fuseScores(query, lang);
  const ranked = faqEntries
    .map((item) => ({
      item,
      score: scoreEntry(query, queryTokens, item, lang, fuzzy.get(item.id) || 0),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < CONFIDENT_SCORE) {
    return notFound(best?.score || 0);
  }
  if (second && second.score >= CONFIDENT_SCORE && best.score - second.score < AMBIGUITY_GAP && best.score < 0.99) {
    return notFound(best.score);
  }

  return {
    status: MatchStatus.ANSWERED,
    faqId: best.item.id,
    score: best.score,
    answer: best.item.answer[lang] || best.item.answer.en,
    sourceUrl: best.item.sourceUrl || null,
  };
}

export function findLocalAnswer(question, language) {
  const match = matchQuestion(question, language);
  if (match.status !== MatchStatus.ANSWERED) {
    return { status: MatchStatus.NOT_FOUND, answer: null, sourceUrl: null };
  }
  return {
    status: MatchStatus.ANSWERED,
    answer: match.answer,
    sourceUrl: match.sourceUrl,
  };
}
