/**
 * Rebuild demo/content.json from the Savanna lesson HTML.
 * Run: node demo/extract-content.js
 *
 * Block tags become line breaks. A line wrap inside a paragraph becomes a
 * space. Adjacent elements get a space when their words would otherwise touch,
 * and punctuation stays attached to the word before it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lessonPath = path.resolve(here, "../savanna/pages/concept-with-navigation.html");
const outPath = path.join(here, "content.json");

const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table",
  "tbody", "thead", "tr", "ul",
]);
const SKIP = new Set(["script", "style", "button", "input", "textarea", "select", "form"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

export function extractLesson(html) {
  const root = findById(parse(html), "curriculum_navigation_content");
  const sections = [];
  if (root) walk(root, [], sections);
  return {
    title: (sections[0] && sections[0].title) || "",
    sources: ["/demo/data/jobs.json"],
    sections: sections.map(function (section) {
      return {
        id: section.id,
        title: section.title,
        url: "/pages/concept-with-navigation.html#" + section.id,
        lang: "en",
        text: finish(section.parts),
      };
    }),
  };
}

function walk(node, ancestors, sections) {
  if (node.type === "text") {
    const current = sections[sections.length - 1];
    if (current) current.parts.push(node.value);
    return;
  }
  if (SKIP.has(node.name) || hasClass(node, "btn") || hasClass(node, "button_to") || hasClass(node, "anchor")) {
    return;
  }
  if (isHeading(node.name)) {
    sections.push({
      id: headingId(node, ancestors),
      title: inlineText(node),
      parts: [],
    });
    return;
  }
  const block = BLOCK.has(node.name);
  const current = sections[sections.length - 1];
  if (block && current) current.parts.push({ break: true });
  ancestors.push(node);
  for (let i = 0; i < node.children.length; i += 1) walk(node.children[i], ancestors, sections);
  ancestors.pop();
  if (block && sections.length) sections[sections.length - 1].parts.push({ break: true });
}

function inlineText(node) {
  const parts = [];
  collectInline(node, parts);
  return finish(parts).replace(/\n+/g, " ");
}

function collectInline(node, parts) {
  if (node.type === "text") {
    parts.push(node.value);
    return;
  }
  if (SKIP.has(node.name) || hasClass(node, "anchor")) return;
  for (let i = 0; i < node.children.length; i += 1) collectInline(node.children[i], parts);
}

function finish(parts) {
  let text = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part && part.break) {
      if (text && !text.endsWith("\n")) text += "\n";
      continue;
    }
    const piece = decode(part).replace(/\s+/g, " ");
    if (!piece.trim()) {
      if (text && !/\s$/.test(text)) text += " ";
      continue;
    }
    const core = piece.trim();
    if (text && !/\s$/.test(text) && gap(text, core)) text += " ";
    else if (text && !/\s$/.test(text) && /^\s/.test(piece)) text += " ";
    text += core;
    if (/\s$/.test(piece)) text += " ";
  }
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/[ ]+([.,;:!?።፣])/g, "$1")
    .trim();
}

function gap(prev, next) {
  const left = prev.charAt(prev.length - 1);
  const right = next.charAt(0);
  if (/\s/.test(left) || /\s/.test(right)) return false;
  if (/[.,;:!?።፣)\]\}]/.test(right)) return false;
  return /[\p{L}\p{N}]/u.test(left) && /[\p{L}\p{N}]/u.test(right);
}

function isHeading(name) {
  return name === "h1" || name === "h4";
}

function headingId(node, ancestors) {
  const anchor = findAnchor(node);
  if (anchor && anchor.attrs.id) return anchor.attrs.id;
  if (node.attrs.id) return node.attrs.id;
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    if (ancestors[i].attrs && ancestors[i].attrs.id) return ancestors[i].attrs.id;
  }
  return "section";
}

function findAnchor(node) {
  if (node.type !== "el") return null;
  if (node.name === "a" && node.attrs.id) return node;
  for (let i = 0; i < node.children.length; i += 1) {
    const found = findAnchor(node.children[i]);
    if (found) return found;
  }
  return null;
}

function hasClass(node, name) {
  const value = node.attrs && node.attrs.class ? node.attrs.class : "";
  return value.split(/\s+/).includes(name);
}

function findById(node, id) {
  if (!node || node.type !== "el") return null;
  if (node.attrs.id === id) return node;
  for (let i = 0; i < node.children.length; i += 1) {
    const found = findById(node.children[i], id);
    if (found) return found;
  }
  return null;
}

function decode(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (all, body) {
    if (body.charAt(0) === "#") {
      const code = body.charAt(1) === "x" || body.charAt(1) === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : all;
  });
}

function parse(html) {
  const root = { type: "el", name: "root", attrs: {}, children: [] };
  const stack = [root];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.charAt(i) === "<") {
      const tag = readTag(html, i);
      if (!tag) {
        pushText(stack, "<");
        i += 1;
        continue;
      }
      i = tag.end;
      if (tag.kind === "close") {
        closeTag(stack, tag.name);
        continue;
      }
      const node = { type: "el", name: tag.name, attrs: tag.attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!tag.self && !VOID.has(tag.name)) stack.push(node);
      continue;
    }
    const next = html.indexOf("<", i);
    const end = next === -1 ? html.length : next;
    pushText(stack, html.slice(i, end));
    i = end;
  }
  return root;
}

function pushText(stack, value) {
  if (!value) return;
  stack[stack.length - 1].children.push({ type: "text", value: value });
}

function closeTag(stack, name) {
  for (let i = stack.length - 1; i > 0; i -= 1) {
    if (stack[i].name === name) {
      stack.length = i;
      return;
    }
  }
}

function readTag(html, start) {
  let i = start + 1;
  if (i >= html.length) return null;
  const close = html.charAt(i) === "/";
  if (close) i += 1;
  const nameStart = i;
  while (i < html.length && /[A-Za-z0-9]/.test(html.charAt(i))) i += 1;
  if (i === nameStart) return null;
  const name = html.slice(nameStart, i).toLowerCase();
  const attrs = {};
  let self = false;
  while (i < html.length) {
    while (i < html.length && /\s/.test(html.charAt(i))) i += 1;
    if (i >= html.length) return null;
    if (html.charAt(i) === ">") {
      i += 1;
      break;
    }
    if (html.charAt(i) === "/" && html.charAt(i + 1) === ">") {
      self = true;
      i += 2;
      break;
    }
    const attrStart = i;
    while (i < html.length && /[^\s=/>]/.test(html.charAt(i))) i += 1;
    const attr = html.slice(attrStart, i).toLowerCase();
    while (i < html.length && /\s/.test(html.charAt(i))) i += 1;
    let value = "";
    if (html.charAt(i) === "=") {
      i += 1;
      while (i < html.length && /\s/.test(html.charAt(i))) i += 1;
      const quote = html.charAt(i);
      if (quote === "\"" || quote === "'") {
        const end = html.indexOf(quote, i + 1);
        if (end === -1) return null;
        value = html.slice(i + 1, end);
        i = end + 1;
      } else {
        const valueStart = i;
        while (i < html.length && /[^\s>]/.test(html.charAt(i))) i += 1;
        value = html.slice(valueStart, i);
      }
    }
    if (attr && !close) attrs[attr] = decode(value);
    if (!attr) return null;
  }
  return { kind: close ? "close" : "open", name: name, attrs: attrs, self: self, end: i };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = fs.readFileSync(lessonPath, "utf8");
  const lesson = extractLesson(html);
  fs.writeFileSync(outPath, JSON.stringify(lesson, null, 2) + "\n");
}
