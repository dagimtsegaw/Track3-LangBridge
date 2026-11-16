import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, PHONE_ERROR } from "./phone.js";

test("Ethiopian mobiles become +251 and nine digits", function () {
  assert.equal(normalizePhone("0911223344").phone, "+251911223344");
  assert.equal(normalizePhone("0711223344").phone, "+251711223344");
  assert.equal(normalizePhone("+251911223344").phone, "+251911223344");
  assert.equal(normalizePhone("251911223344").phone, "+251911223344");
  assert.equal(normalizePhone("09 11 223 344").phone, "+251911223344");
  assert.equal(normalizePhone("+251 711-223344").phone, "+251711223344");
});

test("a number that is not an Ethiopian mobile is a sentence", function () {
  for (const value of ["", "Ada", "0811223344", "911223344", "+251911223", "+2510911223344", "12345"]) {
    const result = normalizePhone(value);
    assert.equal(result.ok, false, value);
    assert.equal(result.error, PHONE_ERROR);
  }
});
