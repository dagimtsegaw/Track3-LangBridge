/**
 * Offline provider. Scores the host's own sections and copies a short excerpt.
 * Lesson text is copied. It is not rewritten.
 *
 * English tokens drop a small stopword list. Ethiopic tokens (Amharic, Tigrinya)
 * also match by shared prefix and character trigrams, because suffixes change
 * the end of a word.
 *
 * A medical, legal, or immigration question is refused before scoring.
 * answer(question, sections, language) -> { text, sources } | { text: null }
 */

import { adviceReply, isAdviceQuestion } from "./advice.js";

var EN_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "been", "being", "this", "that", "these", "those", "it",
  "its", "with", "as", "by", "from", "at", "what", "how", "do", "does", "did",
  "i", "you", "we", "they", "my", "your", "me", "our", "their", "not", "but",
  "if", "so", "can", "will", "about", "into", "than", "then", "who", "whom",
  "which", "when", "where", "why", "have", "has", "had",
]);

var ETHIOPIC = /[\u1200-\u137F]/;
var EXCERPT_LEN = 320;

/** Combined score at or above this returns a section. Below it, text is null. */
export var THRESHOLD = 0.5;

export function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(value, language) {
  var parts = normalize(value).split(" ").filter(Boolean);
  if (language !== "en") return parts;
  return parts.filter(function (token) {
    if (ETHIOPIC.test(token)) return true;
    return !EN_STOP.has(token);
  });
}

function unique(list) {
  var seen = new Set();
  var out = [];
  for (var i = 0; i < list.length; i += 1) {
    if (seen.has(list[i])) continue;
    seen.add(list[i]);
    out.push(list[i]);
  }
  return out;
}

function sharedPrefix(a, b) {
  var n = Math.min(a.length, b.length);
  var i = 0;
  while (i < n && a.charAt(i) === b.charAt(i)) i += 1;
  return i;
}

function trigrams(token) {
  if (token.length < 3) return [token];
  var out = [];
  for (var i = 0; i <= token.length - 3; i += 1) out.push(token.slice(i, i + 3));
  return out;
}

function jaccard(a, b) {
  var left = trigrams(a);
  var right = new Set(trigrams(b));
  var inter = 0;
  var seen = new Set();
  for (var i = 0; i < left.length; i += 1) {
    if (seen.has(left[i])) continue;
    seen.add(left[i]);
    if (right.has(left[i])) inter += 1;
  }
  var union = seen.size + right.size - inter;
  return union ? inter / union : 0;
}

function matchToken(query, doc) {
  if (!query || !doc) return 0;
  if (query === doc) return 1;
  var eth = ETHIOPIC.test(query) || ETHIOPIC.test(doc);
  if (eth) {
    var prefix = sharedPrefix(query, doc);
    var shorter = Math.min(query.length, doc.length);
    if (prefix >= 2 && prefix / shorter >= 0.6) return 0.85;
    if (jaccard(query, doc) >= 0.4) return 0.7;
    return 0;
  }
  if (query.length >= 4 && doc.length >= 4 && (doc.indexOf(query) === 0 || query.indexOf(doc) === 0)) {
    return 0.75;
  }
  return 0;
}

function bestAgainst(query, docTokens) {
  var best = 0;
  for (var i = 0; i < docTokens.length; i += 1) {
    var score = matchToken(query, docTokens[i]);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

function coverage(queryTokens, docTokens) {
  if (!queryTokens.length || !docTokens.length) return 0;
  var total = 0;
  for (var i = 0; i < queryTokens.length; i += 1) {
    total += bestAgainst(queryTokens[i], docTokens);
  }
  return total / queryTokens.length;
}

/** 0 when nothing overlaps. Title matches add a small bonus so the heading wins ties. */
export function scoreSection(question, section, language) {
  var queryTokens = unique(tokensOf(question, language));
  if (!queryTokens.length) return 0;
  var titleTokens = tokensOf(section && section.title, language);
  var bodyTokens = tokensOf(section && section.text, language);
  var pool = titleTokens.concat(bodyTokens);
  return coverage(queryTokens, pool) + coverage(queryTokens, titleTokens) * 0.25;
}

function findAt(source, token) {
  var lower = source.toLowerCase();
  var probe = token.toLowerCase();
  if (ETHIOPIC.test(token) && token.length > 3) probe = token.slice(0, 3);
  return lower.indexOf(probe);
}

/** Line wraps inside a sentence become spaces. A break before a new sentence stays. */
export function collapseSoftBreaks(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/([^ \n])\n+(?=[a-z])/g, "$1 ")
    .replace(/([^.!?\u1362 \n])\n+(?=[\u1200-\u137F])/g, "$1 ")
    .replace(/ *\n */g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function isSentenceEnd(source, index) {
  var ch = source.charAt(index);
  if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "\u1362") return false;
  var prev = source.charAt(index - 1);
  var next = source.charAt(index + 1);
  if (ch === "." && /\d/.test(prev) && /\d/.test(next)) return false;
  if (next && !/\s/.test(next)) return false;
  return true;
}

function sentenceStart(source, at) {
  var start = 0;
  for (var i = Math.min(at, source.length) - 1; i >= 0; i -= 1) {
    if (isSentenceEnd(source, i)) {
      start = i + 1;
      break;
    }
  }
  while (start < source.length && /\s/.test(source.charAt(start))) start += 1;
  return start;
}

function sentenceEnd(source, at) {
  for (var i = Math.max(0, at); i < source.length; i += 1) {
    if (isSentenceEnd(source, i)) return i + 1;
  }
  return source.length;
}

/** If a cap lands inside a word, finish that word instead of cutting it. */
function finishWord(source, from, to) {
  if (from > 0 && /[\p{L}\p{N}]/u.test(source.charAt(from)) && /[\p{L}\p{N}]/u.test(source.charAt(from - 1))) {
    var back = Math.max(source.lastIndexOf(" ", from), source.lastIndexOf("\n", from));
    from = back >= 0 ? back + 1 : 0;
  }
  if (to < source.length && to > 0 && /[\p{L}\p{N}]/u.test(source.charAt(to - 1)) && /[\p{L}\p{N}]/u.test(source.charAt(to))) {
    var nextSpace = source.indexOf(" ", to);
    var nextNl = source.indexOf("\n", to);
    var next = nextSpace >= 0 && nextNl >= 0 ? Math.min(nextSpace, nextNl) : Math.max(nextSpace, nextNl);
    to = next >= 0 ? next : source.length;
  }
  return { from: from, to: to };
}

export function excerpt(section, question, language) {
  var source = collapseSoftBreaks((section && section.text) || "");
  if (!source) source = collapseSoftBreaks((section && section.title) || "");
  if (!source) return "";
  var queryTokens = tokensOf(question, language).filter(function (token) {
    return token.length >= 2;
  });
  var at = -1;
  for (var i = 0; i < queryTokens.length; i += 1) {
    var found = findAt(source, queryTokens[i]);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at < 0) at = 0;
  var start = sentenceStart(source, at);
  var end = sentenceEnd(source, at);
  var grew = true;
  while (grew && end - start < EXCERPT_LEN) {
    grew = false;
    var back = start - 1;
    while (back >= 0 && /\s/.test(source.charAt(back))) back -= 1;
    if (back >= 0) {
      var prevStart = sentenceStart(source, back);
      if (end - prevStart <= EXCERPT_LEN) {
        start = prevStart;
        grew = true;
      }
    }
    if (end - start >= EXCERPT_LEN) break;
    var look = end;
    while (look < source.length && /\s/.test(source.charAt(look))) look += 1;
    if (look < source.length) {
      var nextEnd = sentenceEnd(source, look);
      if (nextEnd > end && nextEnd - start <= EXCERPT_LEN) {
        end = nextEnd;
        grew = true;
      }
    }
  }
  if (end - start > EXCERPT_LEN) {
    var windowStart = Math.max(start, at - Math.floor(EXCERPT_LEN / 2));
    var windowEnd = Math.min(end, Math.max(windowStart, at) + EXCERPT_LEN);
    var bounded = finishWord(source, windowStart, windowEnd);
    start = bounded.from;
    end = bounded.to;
  }
  while (start < end && /\s/.test(source.charAt(start))) start += 1;
  while (end > start && /\s/.test(source.charAt(end - 1))) end -= 1;
  var slice = source.slice(start, end);
  if (!slice) return "";
  if (start > 0) slice = "\u2026" + slice;
  if (end < source.length) slice = slice + "\u2026";
  return slice;
}

export async function answer(question, sections, language) {
  if (isAdviceQuestion(question)) {
    return { text: adviceReply(language), sources: [], mode: "advice" };
  }
  var list = Array.isArray(sections) ? sections : [];
  var ranked = [];
  for (var i = 0; i < list.length; i += 1) {
    var section = list[i];
    if (!section || typeof section !== "object") continue;
    var score = scoreSection(question, section, language);
    if (score >= THRESHOLD) ranked.push({ section: section, score: score });
  }
  ranked.sort(function (a, b) {
    return b.score - a.score;
  });
  if (!ranked.length) return { text: null };
  var best = ranked[0].score;
  var picked = [];
  for (var j = 0; j < ranked.length && picked.length < 2; j += 1) {
    if (ranked[j].score >= best - 0.15) picked.push(ranked[j]);
  }
  var parts = [];
  var sources = [];
  for (var k = 0; k < picked.length; k += 1) {
    var row = picked[k];
    var text = excerpt(row.section, question, language);
    if (!text) continue;
    parts.push(text);
    sources.push({
      title: String(row.section.title || ""),
      url: String(row.section.url || ""),
    });
  }
  if (!parts.length) return { text: null };
  return { text: parts.join("\n\n"), sources: sources };
}
