import test from "node:test";
import assert from "node:assert/strict";
import { loadKnowledge } from "../api/lib/course.js";
import { topSections } from "../api/lib/retrieve.js";
import { answer } from "../module/providers/none.js";

test("ALX knowledge has the bot FAQ and the extra site pages", function () {
  const sections = loadKnowledge();
  const ids = new Set(sections.map(function (section) {
    return section.id;
  }));
  assert.equal(sections.length, 35);
  assert.ok(ids.has("what_is_alx"));
  assert.ok(ids.has("programme_data_analytics"));
  assert.ok(ids.has("chair_values"));
  assert.ok(ids.has("data_analytics_shape"));
  assert.ok(ids.has("cost_and_sponsorship"));
  const about = sections.find(function (section) {
    return section.id === "what_is_alx";
  });
  assert.match(about.text, /Question \(am\):/);
  assert.match(about.url, /^https:\/\/www\.alxafrica\.com\//);
});

test("a question outside the ALX information does not match", async function () {
  const result = await answer("zzzz quantum pottery", loadKnowledge(), "en");
  assert.equal(result.text, null);
});

test("CHAIR values are retrieved from the site page", function () {
  const picked = topSections("What are the ALX CHAIR values?", loadKnowledge(), "en");
  assert.ok(picked.some(function (section) {
    return section.id === "chair_values";
  }));
});
