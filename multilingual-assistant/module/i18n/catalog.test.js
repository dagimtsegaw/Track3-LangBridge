import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const codes = JSON.parse(fs.readFileSync(path.join(dir, "languages.json"), "utf8")).map(function (item) {
  return item.code;
});

function leaves(value, prefix, out) {
  const keys = Object.keys(value).filter(function (key) {
    return key !== "_needsReview";
  });
  for (const key of keys) {
    const next = prefix ? prefix + "." + key : key;
    if (value[key] && typeof value[key] === "object") leaves(value[key], next, out);
    else out[next] = value[key];
  }
  return out;
}

const bundles = Object.fromEntries(
  codes.map(function (code) {
    return [code, JSON.parse(fs.readFileSync(path.join(dir, code + ".json"), "utf8"))];
  })
);

test("every language file has the same strings as English", function () {
  const english = leaves(bundles.en, "", {});
  for (const code of codes) {
    const got = leaves(bundles[code], "", {});
    assert.deepEqual(Object.keys(got).sort(), Object.keys(english).sort(), code);
    for (const key of Object.keys(english)) {
      assert.equal(typeof got[key], "string", code + " " + key);
      assert.ok(got[key].trim().length > 0, code + " " + key);
    }
  }
});

test("translations are not copies of the English sentence", function () {
  const english = leaves(bundles.en, "", {});
  for (const code of codes) {
    if (code === "en") continue;
    const got = leaves(bundles[code], "", {});
    for (const key of Object.keys(english)) {
      if (key === "language.dir" || key === "language.addis") continue;
      if (english[key] === got[key]) {
        assert.fail(code + " " + key + " still matches English");
      }
    }
  }
});

test("language names, codes, and Arabic direction", function () {
  assert.equal(bundles.en.language.name, "English");
  assert.equal(bundles.am.language.name, "አማርኛ");
  assert.equal(bundles.om.language.name, "Afaan Oromoo");
  assert.equal(bundles.ti.language.name, "ትግርኛ");
  assert.equal(bundles.so.language.name, "Soomaali");
  assert.equal(bundles.ar.language.name, "العربية");
  assert.equal(bundles.ar.language.dir, "rtl");
  for (const code of codes) {
    assert.equal(bundles[code].language.code, code);
    if (code !== "ar") assert.equal(bundles[code].language.dir, "ltr");
  }
  const list = JSON.parse(fs.readFileSync(path.join(dir, "languages.json"), "utf8"));
  assert.deepEqual(
    list.map(function (item) {
      return item.code;
    }),
    codes
  );
});
