import { apiUrl } from "../api-url.js";

/**
 * Calls POST {data-api}/v1/ask. No API key lives here.
 * prepare() reads GET /v1/health and sets `connected` only when ai is true.
 * A failure returns text:null so the widget can use the offline search.
 */

export var connected = false;

function endpoint(apiBase, path) {
  var origin = typeof location !== "undefined" ? location.origin : "";
  return apiUrl(apiBase, path, origin);
}

export async function prepare(apiBase) {
  var url = endpoint(apiBase, "/v1/health");
  if (!url) {
    connected = false;
    return false;
  }
  try {
    var response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("health");
    var body = await response.json();
    connected = !!(body && body.ai === true);
  } catch (error) {
    connected = false;
  }
  return connected;
}

export async function answer(question, sections, language, apiBase) {
  if (!connected) {
    var ready = await prepare(apiBase);
    if (!ready) return { text: null, code: "not-connected" };
  }
  var url = endpoint(apiBase, "/v1/ask");
  if (!url) return { text: null, code: "not-connected" };
  var list = Array.isArray(sections) ? sections : [];
  var payload = {
    question: question,
    language: language,
    sections: list.slice(0, 40).map(function (section) {
      return {
        id: (section && section.id) || "",
        title: (section && section.title) || "",
        url: (section && section.url) || "",
        text: (section && section.text) || "",
        lang: (section && section.lang) || "",
      };
    }),
  };
  try {
    var response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { text: null, code: "not-connected" };
    var body = await response.json();
    if (!body || typeof body !== "object") return { text: null, code: "not-connected" };
    if (body.answer == null || body.answer === "") {
      return { text: null, mode: body.mode || "not-found" };
    }
    var sources = [];
    var raw = Array.isArray(body.sources) ? body.sources : [];
    for (var i = 0; i < raw.length; i += 1) {
      if (!raw[i]) continue;
      sources.push({ title: String(raw[i].title || ""), url: String(raw[i].url || "") });
    }
    return { text: String(body.answer), sources: sources, mode: body.mode || "" };
  } catch (error) {
    return { text: null, code: "not-connected" };
  }
}
