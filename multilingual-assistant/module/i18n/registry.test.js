import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metaFromBundle, indexFromMetas, loadLanguageIndex } from "./registry.js";
import { startPayload } from "../help-link.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

test("shipped language files match the one languages.json entry", function () {
  const index = loadLanguageIndex();
  for (const entry of index.list) {
    const bundle = JSON.parse(fs.readFileSync(path.join(dir, entry.code + ".json"), "utf8"));
    assert.deepEqual(metaFromBundle(bundle), {
      code: entry.code,
      name: entry.name,
      dir: entry.dir,
      speech: entry.speech,
      addis: entry.addis,
    });
  }
  assert.equal(index.speech.am, "am-ET");
  assert.equal(index.addisVoices.am, "am-hamen");
  assert.equal(index.addisVoices.so, undefined);
  assert.equal(index.addisLangs.has("so"), true);
  assert.equal(index.addisLangs.has("en"), false);
  assert.equal(index.addisLangs.has("ar"), false);
});

test("a dummy language file registers speech and an Addis voice", function () {
  const file = path.join(os.tmpdir(), "db-lang-xx-" + process.pid + ".json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      language: {
        code: "xx",
        name: "Testish",
        dir: "rtl",
        speech: "xx-XX",
        addis: "xx-voice",
      },
    })
  );
  try {
    const meta = metaFromBundle(JSON.parse(fs.readFileSync(file, "utf8")));
    const index = indexFromMetas([meta]);
    assert.equal(index.list[0].name, "Testish");
    assert.equal(index.list[0].dir, "rtl");
    assert.equal(index.speech.xx, "xx-XX");
    assert.equal(index.addisVoices.xx, "xx-voice");
    assert.equal(index.addisLangs.has("xx"), true);
    assert.equal(startPayload("xx", "alerts", index.list.map(function (item) { return item.code; })), "xx_alerts");
    assert.equal(startPayload("zz", "tutor", index.list.map(function (item) { return item.code; })), "en_tutor");
  } finally {
    fs.rmSync(file, { force: true });
  }
});
