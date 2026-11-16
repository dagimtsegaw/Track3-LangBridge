import test from "node:test";
import assert from "node:assert/strict";
import { audioType } from "./speech-cloud.js";

test("mp3 and wav bytes keep a type the audio element can play", function () {
  assert.equal(audioType([0x49, 0x44, 0x33, 0x04], ""), "audio/mpeg");
  assert.equal(audioType([0xff, 0xfb, 0x90, 0x00], "application/octet-stream"), "audio/mpeg");
  assert.equal(audioType([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], ""), "audio/wav");
  assert.equal(audioType([0, 1, 2, 3], "audio/mpeg"), "audio/mpeg");
  assert.equal(audioType([0, 1, 2, 3], "audio/wav; charset=binary"), "audio/wav");
  assert.equal(audioType([], "audio/mp3"), "audio/mpeg");
});
