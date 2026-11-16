import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchArea } from "./regions.js";

const table = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "regions.json"), "utf8")
);

function town(name) {
  const found = table.towns.find(function (item) {
    return item.name === name;
  });
  assert.ok(found, name);
  return found;
}

function at(name) {
  const item = town(name);
  return matchArea(item.lat, item.lon, table);
}

test("town table is approximate data and needs a local review", function () {
  assert.match(table._note, /approximate/);
  assert.match(table._note, /needs review/);
  assert.deepEqual(table.ethiopia, { latMin: 3.3, latMax: 15.0, lonMin: 32.9, lonMax: 48.0 });
  assert.equal(table.maxKm, 150);
  assert.equal(table.ambiguousKm, 20);
  assert.equal(table.fallback, "am");
  assert.ok(table.towns.length >= 34);
});

test("Mekelle, Jijiga, Adama, Bahir Dar, and Addis match their listed languages", function () {
  assert.equal(at("Mekelle").language, "ti");
  assert.equal(at("Mekelle").reason, "town");
  assert.equal(at("Jijiga").language, "so");
  assert.equal(at("Adama").language, "om");
  assert.equal(at("Bahir Dar").language, "am");
  assert.equal(at("Addis Ababa").language, "am");
});

test("a remote point inside Ethiopia falls back to Amharic", function () {
  const result = matchArea(4.0, 34.0, table);
  assert.equal(result.language, "am");
  assert.equal(result.reason, "fallback");
});

test("Nairobi and Cairo produce no language suggestion", function () {
  assert.equal(matchArea(-1.2921, 36.8219, table).language, null);
  assert.equal(matchArea(-1.2921, 36.8219, table).reason, "outside");
  assert.equal(matchArea(30.0444, 31.2357, table).language, null);
  assert.equal(matchArea(30.0444, 31.2357, table).reason, "outside");
});

test("two nearby towns with different languages fall back to Amharic", function () {
  const fixture = {
    ethiopia: table.ethiopia,
    maxKm: 150,
    ambiguousKm: 20,
    fallback: "am",
    towns: [
      { name: "North", lat: 9, lon: 38, lang: "om" },
      { name: "South", lat: 9.05, lon: 38, lang: "ti" },
    ],
  };
  const result = matchArea(9.02, 38, fixture);
  assert.equal(result.language, "am");
  assert.equal(result.reason, "ambiguous");
});

test("each listed town maps to its own language from its own coordinates", function () {
  for (const item of table.towns) {
    const result = matchArea(item.lat, item.lon, table);
    assert.equal(result.language, item.lang, item.name);
    assert.equal(result.reason, "town", item.name);
  }
});
