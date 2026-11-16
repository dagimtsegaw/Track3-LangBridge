/**
 * Gemini answers only from the FAQ and the extra ALX site sections.
 * If those sections do not cover the question, the caller says it could not find it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { faqEntries } from '../data/data.js';
import { MatchStatus, matchQuestion } from './faqService.js';
import { normalizeText, tokenize } from '../utils/textNormalizer.js';

export const COULD_NOT_FIND = "I couldn't find this in the information I have.";

const RULES = [
  'Answer only from the provided sections.',
  'The question may have typos, missing letters, or different wording. Treat that as the same question when the meaning matches a section.',
  "Write in the user's language.",
  'Mention the section title in a normal sentence. Do not prefix it with a label.',
  'If the person is only greeting you, thanking you, or making small talk, reply with a short hello and ask what you can help with. Do not use the could-not-find sentence for that.',
  'If the sections do not contain the answer, reply with exactly this sentence and nothing else: ' + COULD_NOT_FIND,
  'Never invent facts, fees, dates, eligibility rules, names, numbers, or sources that are not in the sections.',
].join(' ');

const HOST = 'https://generativelanguage.googleapis.com/v1beta/models/';
const LANGUAGES = ['en', 'am', 'om', 'ti', 'so', 'ar'];

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'at',
  'my', 'me', 'i', 'you', 'your', 'what', 'whats', 'who', 'how', 'where', 'when', 'why', 'does', 'do',
  'did', 'can', 'could', 'please', 'tell', 'about', 'with', 'from', 'that', 'this', 'it', 'its', 'have',
  'has', 'want', 'like', 'there', 'any', 'more', 'long', 'much',
  'ምንድን', 'ነው', 'እንዴት', 'ምን', 'ስለ',
  'maali', 'maal', 'akkamitti',
  'እንታይ', 'እዩ', 'ብዛዕባ',
  'waa', 'maxay', 'sidee', 'fadlan',
  'ما', 'هي', 'هو', 'ماذا', 'كيف', 'عن',
]);

const GENERIC = new Set([
  'alx', 'programme', 'program', 'programmes', 'programs', 'career', 'course', 'courses', 'academy',
]);

const sitePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/siteKnowledge.json');
const siteKnowledge = JSON.parse(fs.readFileSync(sitePath, 'utf8'));

const GREETINGS = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hellow', 'helloo', 'hey', 'heyy', 'hiya', 'yo', 'sup',
  'hi there', 'hey there', 'hello there',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'how are you', 'how are u', 'how r you', 'how are you doing', 'whats up', 'wassup',
  'thanks', 'thank you', 'thank u', 'thx', 'ty', 'thankyou',
  'ok', 'okay', 'cool', 'nice', 'great',
  'bye', 'goodbye', 'good bye', 'see you',
  'selam', 'salaam', 'salam', 'salaam alaikum', 'assalamu alaikum',
  'akkam', 'akkam jirta', 'nagaa', 'naga', 'galatoomi',
  'salaan', 'iska warran', 'mahadsanid',
  'ሰላም', 'ሰላም ነህ', 'ሰላም ነሽ', 'እንደምን አለህ', 'እንደምን ነህ', 'እንደምን ነሽ', 'አመሰግናለሁ',
  'ከመይ ኣለኻ', 'ከመይ ኣለኺ', 'የቐንየለይ',
  'مرحبا', 'اهلا', 'أهلا', 'اهلا وسهلا', 'السلام عليكم', 'كيف حالك', 'شكرا', 'شكرا لك',
]);

export function isGreeting(value) {
  const text = normalizeText(value);
  if (!text || text.length > 48) return false;
  if (GREETINGS.has(text)) return true;
  return /^(hi+|hey+|he+l+o+w*|yo+)$/.test(text);
}

export function knowledgeSections(language) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const docs = faqEntries.map((item) => ({
    id: item.id,
    title: item.question.en,
    url: item.sourceUrl || '',
    text: [item.question.en, item.answer.en, lang === 'en' ? '' : `${item.question[lang]}\n${item.answer[lang]}`]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1500),
  }));
  const extra = Array.isArray(siteKnowledge.sections) ? siteKnowledge.sections : [];
  for (const section of extra) {
    docs.push({
      id: String(section.id || ''),
      title: String(section.title || ''),
      url: String(section.url || ''),
      text: `${section.title || ''}\n${section.text || ''}`.slice(0, 1500),
    });
  }
  return docs;
}

function corpus(language) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const docs = faqEntries.map((item) => ({
    id: item.id,
    title: item.question[lang] || item.question.en,
    url: item.sourceUrl || '',
    text: [
      item.question[lang] || '',
      item.answer[lang] || '',
      item.question.en,
      item.answer.en,
      ...(item.keywords[lang] || []),
      ...(item.keywords.en || []),
    ].join('\n'),
  }));
  const extra = Array.isArray(siteKnowledge.sections) ? siteKnowledge.sections : [];
  for (const section of extra) {
    docs.push({
      id: String(section.id || ''),
      title: String(section.title || ''),
      url: String(section.url || ''),
      text: String(section.title || '') + '\n' + String(section.text || ''),
    });
  }
  return docs;
}

export function selectContext(question, language) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const tokens = tokenize(normalizeText(question)).filter((token) => !STOP.has(token));
  const specific = tokens.filter((token) => !GENERIC.has(token));
  const docs = corpus(lang);
  const picked = [];
  const seen = new Set();

  function add(doc) {
    if (!doc || !doc.id || seen.has(doc.id) || picked.length >= 4) return;
    seen.add(doc.id);
    picked.push({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      text: doc.text,
    });
  }

  const local = matchQuestion(question, lang);
  if (local.status === MatchStatus.ANSWERED) {
    add(docs.find((doc) => doc.id === local.faqId));
  }

  if (specific.length) {
    const ranked = docs
      .map((doc) => {
        const hay = new Set(tokenize(normalizeText(doc.text)));
        const matched = specific.filter((token) => hay.has(token));
        return { doc, score: matched.length / specific.length, matched: matched.length };
      })
      .filter((row) => row.matched >= 1 && row.score >= 0.5)
      .sort((left, right) => right.score - left.score || right.matched - left.matched);
    for (const row of ranked) add(row.doc);
  }

  return picked;
}

export function couldNotFind(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!value) return true;
  if (value === COULD_NOT_FIND.toLowerCase()) return true;
  return value.length < 180 && (value.includes("couldn't find") || value.includes('could not find') || value.includes('couldn’t find'));
}

export async function askGemini({ question, language, sections, fetchImpl, key, model, timeoutMs }) {
  const packed = sections
    .map((section) => 'Title: ' + section.title + '\nURL: ' + section.url + '\n' + section.text)
    .join('\n\n---\n\n');
  const response = await (fetchImpl || fetch)(HOST + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Language: ' + language + '\n\nQuestion: ' + question + '\n\nSections:\n' + packed,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
    signal: AbortSignal.timeout(timeoutMs || 12000),
  });
  if (!response.ok) {
    const error = new Error('gemini');
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts
    : [];
  const list = Array.isArray(parts) ? parts : [];
  return list
    .filter((part) => part && part.thought !== true)
    .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}
