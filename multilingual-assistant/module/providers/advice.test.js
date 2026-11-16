import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adviceReply, isAdviceQuestion, normalizeQuestion } from "./advice.js";
import { normalize } from "./none.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

test("advice matching uses the widget token normaliser", function () {
  const samples = ["Visa?", "ምናባዊ ረዳቶች!", "تأشيرة؟", "Contract   dispute."];
  for (const sample of samples) {
    assert.equal(normalizeQuestion(sample), normalize(sample));
  }
});

test("medical legal and immigration phrases are refused and lesson words are not", function () {
  const hits = [
    "How do I apply for a visa?",
    "I lost my passport",
    "asylum application",
    "What is my refugee status?",
    "I need a lawyer",
    "I will sue the school",
    "This is a contract dispute",
    "Can you give me a diagnosis?",
    "Which medicine should I take?",
    "What dose is safe?",
    "These symptoms worry me",
    "ቪዛ እንዴት አገኛለሁ",
    "viizaa maal",
    "qoricha",
    "fiiso",
    "ምልክታት",
    "كيف أحصل على تأشيرة",
  ];
  for (const question of hits) {
    assert.equal(isAdviceQuestion(question), true, question);
  }
  const misses = [
    "What is shaping the future of VA work?",
    "I have an issue with the lesson",
    "I want to pursue a career",
    "visual design of the page",
    "Does the course explain remote work?",
    "contract of the sample client",
  ];
  for (const question of misses) {
    assert.equal(isAdviceQuestion(question), false, question);
  }
});

test("the refusal sentence matches every language file", function () {
  const codes = ["en", "am", "om", "ti", "so", "ar"];
  for (const code of codes) {
    const bundle = JSON.parse(fs.readFileSync(path.join(dir, "../i18n", code + ".json"), "utf8"));
    assert.equal(adviceReply(code), bundle.errors.advice);
  }
  const english = JSON.parse(fs.readFileSync(path.join(dir, "../i18n/en.json"), "utf8"));
  assert.equal(english.errors.notFound, "I could not find this in the course.");
  assert.equal(adviceReply("fr"), adviceReply("en"));
});
