import test from "node:test";
import assert from "node:assert/strict";
import { formatShownDate } from "./calendar.js";

const when = new Date("2026-11-16T08:30:00Z");

test("Amharic, Tigrinya, and Afaan Oromoo use the Ethiopian calendar", function () {
  const am = formatShownDate(when, "am");
  const ti = formatShownDate(when, "ti");
  const om = formatShownDate(when, "om");
  const en = formatShownDate(when, "en");
  const ar = formatShownDate(when, "ar");
  assert.ok(am.length > 0);
  assert.equal(ti, am);
  assert.equal(om, am);
  assert.notEqual(am, en);
  assert.match(en, /2026/);
  assert.equal(am.includes("2026"), false);
  assert.notEqual(ar, am);
  assert.equal(formatShownDate("not-a-date", "en"), "");
});
