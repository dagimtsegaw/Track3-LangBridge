/**
 * Language metadata lives in each i18n/<code>.json and is copied into
 * languages.json. Speech tags and Addis voice ids are read from that list.
 * Adding a language does not add a line to help-link.js, speech-browser.js,
 * or the Addis set in the server.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function metaFromBundle(bundle) {
  const language = bundle && bundle.language;
  if (!language || typeof language !== "object") return null;
  const code = String(language.code || "").trim().toLowerCase();
  if (!/^[a-z]{2,12}$/.test(code)) return null;
  const name = String(language.name || "").trim();
  const speech = String(language.speech || "").trim();
  if (!name || !speech) return null;
  const addis = String(language.addis == null ? "" : language.addis).trim();
  return {
    code: code,
    name: name,
    dir: language.dir === "rtl" ? "rtl" : "ltr",
    speech: speech,
    addis: addis,
  };
}

export function indexFromMetas(metas) {
  const list = [];
  const speech = {};
  const addisLangs = new Set();
  const addisVoices = {};
  const items = Array.isArray(metas) ? metas : [];
  for (let i = 0; i < items.length; i += 1) {
    const meta = items[i];
    if (!meta || !meta.code) continue;
    const addis = String(meta.addis || "");
    const entry = {
      code: String(meta.code),
      name: String(meta.name || meta.code),
      dir: meta.dir === "rtl" ? "rtl" : "ltr",
      speech: String(meta.speech || ""),
      addis: addis,
    };
    list.push(entry);
    if (entry.speech) speech[entry.code] = entry.speech;
    if (addis && addis !== "none") {
      addisLangs.add(entry.code);
      if (addis !== "catalog") addisVoices[entry.code] = addis;
    }
  }
  return { list: list, speech: speech, addisLangs: addisLangs, addisVoices: addisVoices };
}

export function loadLanguageIndex(file) {
  const target = file || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "languages.json");
  const list = JSON.parse(fs.readFileSync(target, "utf8"));
  return indexFromMetas(list);
}
