import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanBot, startPayload, telegramUrl, screenShareSupported } from "./help-link.js";

const codes = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "i18n", "languages.json"), "utf8")
).map(function (item) {
  return item.code;
});

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";

test("telegram start payload is lang_topic", function () {
  assert.equal(startPayload("am", "accommodation", codes), "am_accommodation");
  assert.equal(startPayload("AM-ET", "tutor", codes), "am_tutor");
  assert.equal(startPayload("zz", "careers", codes), "en_careers");
  assert.equal(startPayload("en", "nope", codes), "en_tutor");
  assert.equal(
    telegramUrl("@SavannaTutorBot", "om", "alerts", codes),
    "https://t.me/SavannaTutorBot?start=om_alerts"
  );
  assert.equal(telegramUrl("bad", "en", "tutor"), "");
  assert.equal(telegramUrl("", "en", "tutor"), "");
  assert.equal(cleanBot("  @SavannaTutorBot  "), "SavannaTutorBot");
});

test("screen sharing is unsupported on Chrome for Android", function () {
  assert.equal(screenShareSupported(ANDROID_CHROME, true), false);
  assert.equal(screenShareSupported(DESKTOP_CHROME, true), true);
  assert.equal(screenShareSupported(DESKTOP_CHROME, false), false);
  assert.equal(screenShareSupported(ANDROID_FIREFOX, true), true);
  assert.equal(screenShareSupported("", false), false);
});
