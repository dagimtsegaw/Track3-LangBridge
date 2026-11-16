/**
 * Browser speechSynthesis. speak(text, lang) uses a voice whose lang tag
 * matches the language. It does not substitute another language.
 */

var current = null;

export function matchingVoices(lang, voices) {
  var base = String(lang || "").toLowerCase().split("-")[0];
  if (!base) return [];
  var list = Array.isArray(voices) ? voices : [];
  var out = [];
  for (var i = 0; i < list.length; i += 1) {
    var tag = String((list[i] && list[i].lang) || "")
      .toLowerCase()
      .replace(/_/g, "-");
    if (tag === base || tag.indexOf(base + "-") === 0) out.push(list[i]);
  }
  return out;
}

export function loadVoices() {
  return new Promise(function (resolve) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    var synth = window.speechSynthesis;
    var existing = synth.getVoices() || [];
    if (existing.length) {
      resolve(existing);
      return;
    }
    var settled = false;
    function finish(force) {
      var list = synth.getVoices() || [];
      if (!force && !list.length) return;
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onChange);
      resolve(list);
    }
    function onChange() {
      finish(false);
    }
    synth.addEventListener("voiceschanged", onChange);
    window.setTimeout(function () {
      finish(true);
    }, 1500);
    try {
      synth.getVoices();
    } catch (err) {
      /* Some browsers throw until voiceschanged. The timeout still resolves. */
    }
  });
}

export function stop() {
  current = null;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speak(text, lang, tag) {
  stop();
  return loadVoices().then(function (voices) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      var missing = new Error("unsupported");
      missing.code = "unsupported";
      throw missing;
    }
    var matches = matchingVoices(lang, voices);
    if (!matches.length) {
      var none = new Error("no-voice");
      none.code = "no-voice";
      throw none;
    }
    return new Promise(function (resolve, reject) {
      var utter = new SpeechSynthesisUtterance(String(text || ""));
      utter.lang = matches[0].lang || tag || lang || "en-US";
      utter.voice = matches[0];
      current = utter;
      utter.onend = function () {
        if (current === utter) current = null;
        resolve("ended");
      };
      utter.onerror = function (event) {
        if (current === utter) current = null;
        var code = (event && event.error) || "speech";
        if (code === "interrupted" || code === "canceled" || code === "cancelled") {
          resolve("aborted");
          return;
        }
        var error = new Error(code);
        error.code = code;
        reject(error);
      };
      window.speechSynthesis.speak(utter);
    });
  });
}
