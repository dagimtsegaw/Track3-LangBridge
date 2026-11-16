import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answer } from "../module/providers/none.js";
import { extractLesson } from "./extract-content.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
const jobs = JSON.parse(fs.readFileSync(path.join(root, "data", "jobs.json"), "utf8"));

const lessonIds = [
  "what-is-shaping-the-future-of-va-work",
  "artificial-intelligence-and-the-future-of-va-work",
  "what-clients-are-likely-to-value-more-and-more",
  "what-this-means-for-aspiring-virtual-assistants",
  "so-is-the-future-of-va-promising",
];

test("content.json is extracted from the lesson, with spaces and whole sentences", function () {
  const html = fs.readFileSync(path.join(root, "../savanna/pages/concept-with-navigation.html"), "utf8");
  const built = extractLesson(html);
  assert.deepEqual(built, content);
  const clients = built.sections.find(function (section) {
    return section.id === "what-clients-are-likely-to-value-more-and-more";
  });
  assert.match(clients.title, /More and More$/);
  assert.match(clients.text, /streamline repetitive/);
  assert.match(clients.text, /combine tool fluency with human strength/);
  for (const section of built.sections) {
    assert.equal(/\n[a-z]/.test(section.text), false, section.id);
  }
});

test("content.json splits the lesson by its real anchors", function () {
  const ids = content.sections.map(function (section) {
    return section.id;
  });
  for (const id of lessonIds) {
    assert.ok(ids.includes(id), id);
    const section = content.sections.find(function (item) {
      return item.id === id;
    });
    assert.equal(section.lang, "en");
    assert.equal(section.url, "/pages/concept-with-navigation.html#" + id);
    assert.ok(section.title.length > 0);
    assert.ok(section.text.length > 40);
  }
  assert.deepEqual(content.sources, ["/demo/data/jobs.json"]);
});

test("jobs.json is a second source with five test listings", function () {
  assert.equal(jobs.sections.length, 5);
  for (const section of jobs.sections) {
    assert.match(section.text, /Test listing only, not a real vacancy/);
    assert.match(section.url, /^\/demo\/data\/jobs\.json#/);
  }
});

test("a lesson question cites the shaping section and does not invent text", async function () {
  const result = await answer("What is shaping the future of VA work?", content.sections, "en");
  assert.equal(result.sources[0].url, "/pages/concept-with-navigation.html#what-is-shaping-the-future-of-va-work");
  const parts = result.text.split("\n\n").map(function (part) {
    return part.replace(/\u2026/g, "").trim();
  });
  for (const part of parts) {
    const hit = content.sections.some(function (section) {
      return (section.text + section.title).includes(part);
    });
    assert.equal(hit, true);
  }
});

test("a test-listing question uses the jobs source", async function () {
  const sections = content.sections.concat(jobs.sections);
  const result = await answer("sample client weekday inbox sorting", sections, "en");
  assert.equal(result.sources[0].url, "/demo/data/jobs.json#test-job-inbox");
  assert.match(result.text.replace(/\u2026/g, ""), /Test listing only, not a real vacancy/);
});
