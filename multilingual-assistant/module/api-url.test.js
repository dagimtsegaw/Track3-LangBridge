import test from "node:test";
import assert from "node:assert/strict";
import { apiUrl } from "./api-url.js";

const origin = "http://localhost:8080";
const page = "http://localhost:8080/demo/blank.html";

test("data-api paths are rooted at the origin, including a trailing slash", function () {
  assert.equal(apiUrl("/api", "/v1/health", origin), "http://localhost:8080/api/v1/health");
  assert.equal(apiUrl("/api/", "/v1/tts", origin), "http://localhost:8080/api/v1/tts");
  assert.equal(apiUrl("api", "/v1/health", origin), "http://localhost:8080/api/v1/health");
  assert.equal(apiUrl("api/", "/v1/tts", origin), "http://localhost:8080/api/v1/tts");
});

test("an absolute data-api is not rewritten onto the page origin", function () {
  assert.equal(
    apiUrl("http://localhost:3000/api", "/v1/health", origin),
    "http://localhost:3000/api/v1/health"
  );
  assert.equal(
    apiUrl("http://localhost:3000/api/", "/v1/tts", origin),
    "http://localhost:3000/api/v1/tts"
  );
});

test("a relative data-api is not resolved against the page folder", function () {
  const againstPage = new URL("api/v1/health", page).href;
  assert.equal(againstPage, "http://localhost:8080/demo/api/v1/health");
  assert.equal(apiUrl("api", "/v1/health", origin), "http://localhost:8080/api/v1/health");
  assert.equal(apiUrl("/api", "/v1/tts", origin), "http://localhost:8080/api/v1/tts");
});
