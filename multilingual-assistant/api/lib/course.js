import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../demo");
const knowledgePath = path.join(demoRoot, "data", "alx-knowledge.json");

/** ALX FAQ plus extra pages from alxafrica.com. Missing file yields []. */
export function loadKnowledge() {
  try {
    const data = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
    return Array.isArray(data.sections) ? data.sections : [];
  } catch {
    return [];
  }
}

/** Reads demo/content.json and any sources it lists. Missing files yield []. */
export function loadCourse(file) {
  const start = file || path.join(demoRoot, "content.json");
  const seen = new Set();
  const out = [];
  function addFile(filePath) {
    const abs = path.resolve(filePath);
    if (seen.has(abs)) return;
    seen.add(abs);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch {
      return;
    }
    const sections = Array.isArray(data.sections) ? data.sections : [];
    for (let i = 0; i < sections.length; i += 1) out.push(sections[i]);
    const sources = Array.isArray(data.sources) ? data.sources : [];
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      if (typeof source !== "string") continue;
      if (source.startsWith("/demo/")) addFile(path.join(demoRoot, source.slice("/demo/".length)));
      else if (source.startsWith(".")) addFile(path.resolve(path.dirname(abs), source));
    }
  }
  addFile(start);
  return out;
}
