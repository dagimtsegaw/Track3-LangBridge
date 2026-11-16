import test from "node:test";
import assert from "node:assert/strict";
import { runPageTranslation, selectWithinCap } from "./page-translate.js";

test("identical strings are sent once and applied to every match", async function () {
  var calls = [];
  var result = await runPageTranslation({
    items: [{ core: "Hello" }, { core: "Hello" }, { core: "Other" }],
    lang: "am",
    send: function (texts) {
      calls.push(texts.slice());
      return Promise.resolve(texts.map(function (text) {
        return "[" + text + "]";
      }));
    },
  });
  assert.deepEqual(calls, [["Hello", "Other"]]);
  assert.deepEqual(result.values, ["[Hello]", "[Hello]", "[Other]"]);
  assert.equal(result.translated, 3);
  assert.equal(result.failed, 0);
});

test("the character cap counts each distinct string once", function () {
  var selected = selectWithinCap(
    [{ core: "aaaa" }, { core: "aaaa" }, { core: "bbbb" }, { core: "cccc" }],
    8,
    null
  );
  assert.equal(selected.items.length, 3);
  assert.equal(selected.capped, 1);
  assert.equal(selected.characters, 8);
});

test("a failed batch is retried, then split, and the miss count is what is still missing", async function () {
  var calls = [];
  var result = await runPageTranslation({
    items: [{ core: "a" }, { core: "b" }, { core: "c" }, { core: "d" }],
    lang: "am",
    batchCount: 4,
    batchChars: 3000,
    send: function (texts) {
      calls.push(texts.join(","));
      if (texts.length > 2) return Promise.reject(new Error("no"));
      if (texts.indexOf("a") !== -1) return Promise.reject(new Error("no"));
      return Promise.resolve(texts.map(function (text) {
        return "X" + text;
      }));
    },
  });
  assert.deepEqual(calls, ["a,b,c,d", "a,b,c,d", "a,b", "c,d"]);
  assert.equal(result.failed, 2);
  assert.equal(result.translated, 2);
  assert.equal(result.values[0], null);
  assert.equal(result.values[1], null);
  assert.equal(result.values[2], "Xc");
  assert.equal(result.values[3], "Xd");
});
