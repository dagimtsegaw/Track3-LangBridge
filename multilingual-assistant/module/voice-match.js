/**
 * Matches a transcript to command phrases from i18n JSON.
 * Phrases stay in the language files. This file only compares them.
 */

var PREFIX = { goToSection: true, changeLanguage: true };

/* Filler words are dropped before a loose match. Weak words count toward a match but cannot trigger one alone. */
var FILLER = toSet("a an the to of for my me i it this that please can could would you now just");
var WEAK = toSet("go make text page on off turn set show more less line all voice commands size");
var MIN_PRECISION = 0.6;

function toSet(words) {
  var out = {};
  var list = words.split(" ");
  for (var i = 0; i < list.length; i += 1) out[list[i]] = true;
  return out;
}

export function normalizePhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchCommand(transcript, phraseSets) {
  var heard = normalizePhrase(transcript);
  if (!heard) return null;
  var entries = [];
  var sets = Array.isArray(phraseSets) ? phraseSets : [];
  for (var s = 0; s < sets.length; s += 1) {
    var commands = sets[s] || {};
    var ids = Object.keys(commands);
    for (var i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      var phrases = commands[id];
      if (!Array.isArray(phrases)) continue;
      for (var p = 0; p < phrases.length; p += 1) {
        var phrase = normalizePhrase(phrases[p]);
        if (!phrase) continue;
        entries.push({ id: id, phrase: phrase, prefix: PREFIX[id] === true, order: entries.length });
      }
    }
  }
  var exact = entries.slice().sort(function (a, b) {
    return b.phrase.length - a.phrase.length;
  });
  for (var e = 0; e < exact.length; e += 1) {
    var item = exact[e];
    if (item.prefix) {
      if (heard === item.phrase) return { id: item.id, arg: "" };
      var lead = item.phrase + " ";
      if (heard.indexOf(lead) === 0) {
        return { id: item.id, arg: heard.slice(lead.length).trim() };
      }
      continue;
    }
    if (heard === item.phrase) return { id: item.id, arg: "" };
  }
  return looseCommand(heard, entries);
}

/**
 * A partial or misheard phrase still runs a command when most of what was heard
 * belongs to it: "open" or "open a" opens the assistant. Ties go to the command
 * listed first in the language file.
 */
function looseCommand(heard, entries) {
  var words = heard.split(" ");
  var tokens = contentTokens(words);
  if (!tokens.length) return null;
  var best = null;
  var prefixHit = null;
  for (var i = 0; i < entries.length; i += 1) {
    var item = entries[i];
    var phraseTokens = contentTokens(item.phrase.split(" "));
    if (!phraseTokens.length) continue;
    if (item.prefix) {
      var withArg = loosePrefix(words, phraseTokens);
      if (withArg && (!prefixHit || (!prefixHit.arg && withArg.arg))) {
        prefixHit = { id: item.id, arg: withArg.arg };
      }
      continue;
    }
    var score = scoreTokens(tokens, phraseTokens);
    if (!score) continue;
    if (!best || score.total > best.total) {
      best = { id: item.id, total: score.total, full: score.full };
    }
  }
  if (best && best.full) return { id: best.id, arg: "" };
  if (prefixHit && prefixHit.arg) return prefixHit;
  if (best) return { id: best.id, arg: "" };
  return prefixHit;
}

function contentTokens(words) {
  var out = [];
  for (var i = 0; i < words.length; i += 1) {
    if (words[i] && !FILLER[words[i]]) out.push(words[i]);
  }
  return out;
}

function scoreTokens(heard, phrase) {
  var sum = 0;
  var strong = false;
  var covered = {};
  for (var h = 0; h < heard.length; h += 1) {
    var top = 0;
    for (var p = 0; p < phrase.length; p += 1) {
      var q = tokenQuality(heard[h], phrase[p]);
      if (q > 0) covered[p] = true;
      if (q > top) top = q;
    }
    if (top > 0 && !WEAK[heard[h]]) strong = true;
    sum += top;
  }
  var precision = sum / heard.length;
  if (!strong || precision < MIN_PRECISION) return null;
  var recall = Object.keys(covered).length / phrase.length;
  var firstBonus = covered[0] ? 0.1 : 0;
  var leadBonus = tokenQuality(heard[0], phrase[0]) > 0 ? 0.15 : 0;
  return {
    total: precision * 2 + recall + firstBonus + leadBonus,
    full: precision >= 0.99 && recall >= 0.99,
  };
}

/* "section quiz" or "language amharic": the words up to the key word of the phrase, then the rest is the argument. */
function loosePrefix(words, phrase) {
  var key = phrase[phrase.length - 1];
  for (var j = 0; j < words.length; j += 1) {
    if (tokenQuality(words[j], key) < 0.7) continue;
    for (var k = 0; k < j; k += 1) {
      if (FILLER[words[k]]) continue;
      var known = false;
      for (var p = 0; p < phrase.length && !known; p += 1) known = tokenQuality(words[k], phrase[p]) > 0;
      if (!known) return null;
    }
    var rest = words.slice(j + 1);
    while (rest.length && FILLER[rest[0]]) rest.shift();
    return { arg: rest.join(" ") };
  }
  return null;
}

function tokenQuality(heard, phrase) {
  if (heard === phrase) return 1;
  if (heard.length >= 2 && phrase.indexOf(heard) === 0) return 0.8;
  if (phrase.length >= 3 && heard.indexOf(phrase) === 0) return 0.8;
  var shorter = Math.min(heard.length, phrase.length);
  if (shorter >= 4) {
    var distance = editDistance(heard, phrase, 2);
    if (distance <= 1) return 0.7;
    if (shorter >= 7 && distance <= 2) return 0.6;
  }
  return 0;
}

function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  var prev = [];
  for (var j = 0; j <= b.length; j += 1) prev.push(j);
  for (var i = 1; i <= a.length; i += 1) {
    var row = [i];
    var low = i;
    for (var k = 1; k <= b.length; k += 1) {
      var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      var value = Math.min(prev[k] + 1, row[k - 1] + 1, prev[k - 1] + cost);
      row.push(value);
      if (value < low) low = value;
    }
    if (low > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

export function matchHeading(query, headings) {
  var q = normalizePhrase(query);
  if (!q) return -1;
  var best = -1;
  var bestScore = 0;
  var list = Array.isArray(headings) ? headings : [];
  for (var i = 0; i < list.length; i += 1) {
    var name = normalizePhrase(list[i]);
    if (!name) continue;
    var score = scorePair(q, name);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 0.45 ? best : -1;
}

function scorePair(q, name) {
  if (q === name) return 1;
  if (q.length >= 3 && (name.indexOf(q) !== -1 || (q.indexOf(name) !== -1 && name.length >= 3))) {
    return 0.85;
  }
  var qt = q.split(" ");
  var nt = name.split(" ");
  var hit = 0;
  var considered = 0;
  for (var i = 0; i < qt.length; i += 1) {
    if (qt[i].length < 2) continue;
    considered += 1;
    if (nt.indexOf(qt[i]) !== -1) hit += 1;
  }
  if (!considered) return 0;
  return (hit / considered) * 0.75;
}

export function matchLanguage(arg, nameMaps) {
  var heard = normalizePhrase(arg);
  if (!heard) return "";
  var maps = Array.isArray(nameMaps) ? nameMaps : [];
  for (var i = 0; i < maps.length; i += 1) {
    var map = maps[i] || {};
    var codes = Object.keys(map);
    for (var c = 0; c < codes.length; c += 1) {
      var code = String(codes[c] || "").toLowerCase();
      if (!code) continue;
      if (heard === code || heard === normalizePhrase(map[codes[c]])) return code;
    }
  }
  return "";
}

/** Split long text on a space or sentence mark so each part can be spoken. */
export function chunkText(text, limit) {
  var max = limit > 40 ? limit : 2400;
  var rest = String(text || "").replace(/\s+/g, " ").trim();
  if (!rest) return [];
  var parts = [];
  while (rest.length > max) {
    var slice = rest.slice(0, max);
    var cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("። "), slice.lastIndexOf(" "));
    if (cut < Math.floor(max * 0.5)) cut = max;
    else cut += 1;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
