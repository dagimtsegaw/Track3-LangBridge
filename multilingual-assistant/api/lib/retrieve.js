/**
 * Same threshold and ranking as module/providers/none.js.
 * The model is only offered sections that already cleared that threshold.
 */

import { answer as offlineAnswer, scoreSection, THRESHOLD } from "../../module/providers/none.js";

export function cleanSections(raw, limit) {
  if (!Array.isArray(raw)) return [];
  const max = Number.isFinite(limit) && limit > 0 ? limit : 40;
  const out = [];
  for (let i = 0; i < raw.length && out.length < max; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const title = String(item.title || "").slice(0, 300);
    const text = String(item.text || "").slice(0, 8000);
    if (!title && !text) continue;
    out.push({
      id: String(item.id || "").slice(0, 200),
      title: title,
      url: safeUrl(item.url),
      text: text,
      lang: String(item.lang || "").slice(0, 12),
    });
  }
  return out;
}

export function safeUrl(url) {
  const value = String(url || "").trim().slice(0, 1000);
  if (!value) return "";
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return value;
  } catch {
    return "";
  }
  return "";
}

/** Up to two sections at or above the offline threshold, within 0.15 of the best. */
export function topSections(question, sections, language) {
  const ranked = [];
  const list = Array.isArray(sections) ? sections : [];
  for (let i = 0; i < list.length; i += 1) {
    const section = list[i];
    if (!section || typeof section !== "object") continue;
    const score = scoreSection(question, section, language);
    if (score >= THRESHOLD) ranked.push({ section: section, score: score });
  }
  ranked.sort(function (a, b) {
    return b.score - a.score;
  });
  if (!ranked.length) return [];
  const best = ranked[0].score;
  const picked = [];
  for (let i = 0; i < ranked.length && picked.length < 2; i += 1) {
    if (ranked[i].score >= best - 0.15) picked.push(ranked[i].section);
  }
  return picked;
}

export function sourcesOf(sections) {
  return sections.map(function (section) {
    return {
      title: String(section.title || ""),
      url: safeUrl(section.url),
    };
  });
}

export function offlineFrom(question, sections, language) {
  return offlineAnswer(question, sections, language);
}
