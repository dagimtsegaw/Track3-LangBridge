import test from "node:test";
import assert from "node:assert/strict";
import { answer, excerpt, scoreSection } from "./none.js";

const shaping = {
  id: "what-is-shaping-the-future-of-va-work",
  title: "What is Shaping the Future of VA Work?",
  url: "/pages/concept-with-navigation.html#what-is-shaping-the-future-of-va-work",
  lang: "en",
  text: "More remote-first businesses. Companies are now more comfortable building distributed teams. Artificial Intelligence is making it easier to draft, summarize, organize, research, schedule, and automate routine tasks.",
};

const clients = {
  id: "what-clients-are-likely-to-value-more-and-more",
  title: "What Clients Are Likely to Value More and More",
  url: "/pages/concept-with-navigation.html#what-clients-are-likely-to-value-more-and-more",
  lang: "en",
  text: "Clients will increasingly value VAs who can use AI tools responsibly. Specialized expertise will likely reward VAs who develop deeper skills.",
};

const englishSections = [shaping, clients];

const amharic = {
  id: "am-va",
  title: "ምናባዊ ረዳት",
  url: "#am-va",
  lang: "am",
  text: "ምናባዊ ረዳት ሥራውን በሰው ችሎታ እና በመሳሪያ ይደግፋል።",
};

function pieces(text) {
  return String(text || "")
    .split("\n\n")
    .map(function (part) {
      return part.replace(/\u2026/g, "");
    });
}

function isExcerptOf(part, sections) {
  return sections.some(function (section) {
    var source = String(section.text || "") + String(section.title || "");
    return source.includes(part.trim());
  });
}

test("english question returns the shaping section excerpt and source", async function () {
  const result = await answer("How is artificial intelligence shaping VA work?", englishSections, "en");
  assert.equal(typeof result.text, "string");
  assert.ok(result.text.length > 0);
  assert.equal(result.sources[0].url, shaping.url);
  assert.equal(result.sources[0].title, shaping.title);
  for (const part of pieces(result.text)) {
    assert.equal(isExcerptOf(part, englishSections), true);
  }
  assert.equal(result.text.includes("quantum"), false);
});

test("english punctuation and stopwords still find the lesson", async function () {
  const result = await answer("What is the future of VA work?", englishSections, "en");
  assert.equal(result.sources[0].url, shaping.url);
});

test("english miss is below threshold", async function () {
  const result = await answer("quantum photosynthesis theorem", englishSections, "en");
  assert.deepEqual(result, { text: null });
  assert.equal(scoreSection("what is the", shaping, "en"), 0);
});

test("amharic suffix still matches the section", async function () {
  const result = await answer("ምናባዊ ረዳቶች ሥራ", [amharic], "am");
  assert.equal(typeof result.text, "string");
  assert.equal(result.sources[0].url, amharic.url);
  for (const part of pieces(result.text)) {
    assert.equal(isExcerptOf(part, [amharic]), true);
  }
});

test("amharic trigram matches a word that does not share a long prefix", async function () {
  const section = {
    id: "tri",
    title: "ተማሪዎች",
    url: "#tri",
    lang: "am",
    text: "ተማሪዎች ትምህርት ይማራሉ።",
  };
  const result = await answer("ልማሪዎች", [section], "am");
  assert.equal(typeof result.text, "string");
  assert.ok(result.text.includes("ተማሪዎች"));
});

test("excerpt joins a wrapped sentence and stops at a sentence boundary", function () {
  const padding = "Padding sentence number remains intact. ".repeat(6);
  const section = {
    title: "Value",
    url: "#value",
    text: padding + "Clients streamline\nrepetitive tasks in this sentence. " + ("Closing sentence stays out. ".repeat(8)),
  };
  const text = excerpt(section, "streamline repetitive", "en");
  const body = text.replace(/\u2026/g, "").trim();
  assert.match(body, /streamline repetitive/);
  assert.equal(body.includes("\n"), false);
  assert.match(body, /[.!?]$/);
  const collapsed = section.text.replace(/\n(?=[a-z])/g, " ");
  const at = collapsed.indexOf(body);
  assert.ok(at >= 0);
  const next = collapsed.charAt(at + body.length);
  assert.equal(next === "" || /\s/.test(next), true);
  const prev = at === 0 ? "" : collapsed.charAt(at - 1);
  assert.equal(prev === "" || /\s/.test(prev), true);
});

test("a long sentence is not cut in the middle of a word", function () {
  const words = "alpha beta gamma delta epsilon zeta eta theta iota kappa".split(" ");
  const sentence = words.join(" ") + " marker " + words.join(" ") + ".";
  const section = { title: "Long", url: "#long", text: sentence.repeat(3) };
  const text = excerpt(section, "marker", "en");
  const body = text.replace(/\u2026/g, "").trim();
  assert.match(body, /\bmarker\b/);
  const at = section.text.indexOf(body);
  assert.ok(at >= 0);
  const prev = at === 0 ? "" : section.text.charAt(at - 1);
  const next = section.text.charAt(at + body.length);
  assert.equal(prev === "" || /\s/.test(prev), true);
  assert.equal(next === "" || /\s/.test(next), true);
  assert.equal(/[A-Za-z]$/.test(body) && /[A-Za-z]/.test(next), false);
});

test("unrelated amharic question returns null", async function () {
  const result = await answer("የአየር ሁኔታ ትንበያ", [amharic], "am");
  assert.equal(result.text, null);
});

test("a visa question is refused before any excerpt", async function () {
  const section = {
    title: "Visa desk",
    url: "#visa",
    text: "Bring your visa and passport to the office.",
  };
  const result = await answer("How do I get a visa?", [section], "en");
  assert.equal(result.mode, "advice");
  assert.equal(result.text, "Please talk to a person.");
  assert.deepEqual(result.sources, []);
  assert.equal(result.text.includes("passport"), false);
  assert.equal(result.text.includes("Bring your visa"), false);
});
