/**
 * POST {api}/v1/tts and play the bytes. No key is stored here.
 * The address comes from apiUrl(), rooted at the origin, not the page folder.
 * speak(text, lang) plays only after the caller starts it (a click or command).
 * The caller should pass the Audio element it primed during that click.
 * stop() aborts the request and the player.
 */

import { apiUrl } from "../api-url.js";

var apiBase = "";
var audio = null;
var objectUrl = "";
var controller = null;
var generation = 0;
var bufferSource = null;

export function prepare(base) {
  apiBase = String(base || "").replace(/\/$/, "");
}

/** Pick a type the audio element can decode. Addis sends mp3; Gemini speech is wav. */
export function audioType(bytes, headerType) {
  var header = String(headerType || "").split(";")[0].trim().toLowerCase();
  if (header === "audio/mp3" || header === "audio/mpeg") return "audio/mpeg";
  if (header === "audio/wav" || header === "audio/wave" || header === "audio/x-wav") return "audio/wav";
  var data = bytes || [];
  if (data.length >= 3 && data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return "audio/mpeg";
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return "audio/wav";
  }
  return "audio/mpeg";
}

function endpoint(path) {
  var origin = typeof location !== "undefined" ? location.origin : "";
  return apiUrl(apiBase, path, origin);
}

function haltPlayback() {
  if (bufferSource) {
    try {
      bufferSource.stop();
    } catch (err) {
      /* Already stopped. */
    }
    bufferSource = null;
  }
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.pause();
    } catch (err) {
      /* Already stopped. */
    }
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
}

export function stop() {
  generation += 1;
  if (controller) {
    controller.abort();
    controller = null;
  }
  haltPlayback();
}

function reason(error, mime) {
  var name = error && error.name ? error.name : "";
  var message = error && error.message ? error.message : "";
  var text = name && message && message.indexOf(name) !== 0 ? name + ": " + message : message || name;
  if (!text) text = "The browser did not play the audio.";
  if (mime) text += " (" + mime + ")";
  var wrapped = new Error(text);
  wrapped.status = error && error.status;
  return wrapped;
}

function playBuffer(context, bytes) {
  var copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return context.decodeAudioData(copy).then(function (buffer) {
    var source = context.createBufferSource();
    bufferSource = source;
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
    return new Promise(function (resolve) {
      source.onended = function () {
        if (bufferSource === source) bufferSource = null;
        resolve("ended");
      };
    });
  });
}

export function speak(text, lang, hooks) {
  stop();
  var token = generation;
  var notify = hooks || {};
  var url = endpoint("/v1/tts");
  if (!url) {
    var missing = new Error("No speech server is set.");
    missing.status = 501;
    return Promise.reject(missing);
  }
  if (notify.loading) notify.loading();
  controller = new AbortController();
  var signal = controller.signal;
  return fetch(url, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      accept: "audio/mpeg, audio/wav, application/json",
    },
    body: JSON.stringify({ text: String(text || ""), language: lang || "en" }),
    signal: signal,
  })
    .then(function (response) {
      if (token !== generation) return null;
      if (!response.ok) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          var error = new Error((body && body.error) || "The speech server did not return audio.");
          error.status = response.status;
          error.path = url;
          throw error;
        });
      }
      var headerType = response.headers.get("content-type") || "";
      return response.arrayBuffer().then(function (buffer) {
        return { buffer: buffer, headerType: headerType };
      });
    })
    .then(function (payload) {
      if (token !== generation || !payload) return "aborted";
      var bytes = new Uint8Array(payload.buffer);
      if (!bytes.length) {
        var empty = new Error("The speech server returned empty audio.");
        empty.status = 502;
        empty.path = url;
        throw empty;
      }
      var mime = audioType(bytes, payload.headerType);
      var blob = new Blob([bytes], { type: mime });
      objectUrl = URL.createObjectURL(blob);
      audio = notify.audio || new Audio();
      audio.setAttribute("playsinline", "");
      audio.src = objectUrl;
      var played = audio.play();
      var started = played && played.then ? played : Promise.resolve();
      return started.then(function () {
        if (token !== generation) return "aborted";
        if (notify.playing) notify.playing();
        return new Promise(function (resolve) {
          audio.onended = function () {
            resolve("ended");
          };
          audio.onerror = function () {
            resolve("ended");
          };
        });
      }).catch(function (playErr) {
        if (token !== generation) return "aborted";
        var context = notify.context;
        if (context && context.decodeAudioData) {
          return playBuffer(context, bytes).then(function (result) {
            if (token !== generation) return "aborted";
            if (notify.playing) notify.playing();
            return result;
          }).catch(function () {
            throw reason(playErr, mime);
          });
        }
        throw reason(playErr, mime);
      });
    })
    .catch(function (error) {
      if (token !== generation || (error && error.name === "AbortError")) return "aborted";
      if (error && !error.path) error.path = url;
      throw error;
    });
}
