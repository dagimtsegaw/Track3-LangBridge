import test from "node:test";
import assert from "node:assert/strict";
import { matchingVoices } from "./speech-browser.js";

test("a voice counts only when its language tag matches", function () {
  const voices = [
    { lang: "en-US", name: "English" },
    { lang: "en-GB", name: "British" },
    { lang: "ar-SA", name: "Arabic" },
    { lang: "am_ET", name: "Amharic" },
  ];
  assert.equal(matchingVoices("en", voices).length, 2);
  assert.equal(matchingVoices("ar", voices).length, 1);
  assert.equal(matchingVoices("am", voices).length, 1);
  assert.equal(matchingVoices("om", voices).length, 0);
  assert.equal(matchingVoices("ti", []).length, 0);
  assert.equal(matchingVoices("so", null).length, 0);
});

