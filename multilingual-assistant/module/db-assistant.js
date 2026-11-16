/**
 * Savanna Assistant.
 *
 * One classic script defines <db-assistant>. UI text is loaded from i18n/*.json
 * (fallback: selected language, then English). Answers come from the host's
 * content file, or from <main> headings when that file is missing. The offline
 * provider is providers/none.js. providers/cloud.js calls the API when health
 * says a model is configured, and otherwise leaves the answer to none.js.
 * Speech uses providers/speech-cloud.js and providers/speech-browser.js.
 * Voice commands match phrases in i18n via voice-match.js. Host display
 * changes go through one style element, id db-a11y-effects.
 * A saved language wins. An Addis time zone can suggest Amharic; it never
 * switches by itself. Location and page translation start only after a click.
 * Talk to a person opens a dialog. A ticket is posted to /v1/escalations, or
 * kept on this phone until the network is back. Screen sharing starts only
 * from a tap and stays a local preview.
 *
 *   <script src="/module/db-assistant.js"
 *           data-lang="auto" data-api="/api" data-content="/demo/content.json"
 *           defer></script>
 */
(function () {
  "use strict";

  var LANG_KEY = "db-assistant:lang";
  var TZ_DISMISS_KEY = "db-assistant:tz-dismiss";
  var COMMANDS_KEY = "db-assistant:commands";
  var A11Y_KEY = "db-assistant:a11y";
  var OUTBOX_KEY = "db-assistant:outbox";
  var SHARE_KEY = "db-assistant:share";
  /** How many suggested topics to show before the more control. */
  var CHIP_PAGE = 3;
  /** A short silent wav so play() can start during the click, before the file arrives. */
  var SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

  var bootScript = captureBootScript();
  var scriptUrl = resolveScriptUrl(bootScript);
  var bundles = new Map();
  var providers = new Map();
  var languageListPromise = null;

  function captureBootScript() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = scripts[i].getAttribute("src") || "";
      if (src.indexOf("db-assistant.js") !== -1) return scripts[i];
    }
    return null;
  }

  function resolveScriptUrl(script) {
    if (script && script.src) return script.src;
    try {
      return eval("import.meta.url");
    } catch (err) {
      return "";
    }
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("load");
      return response.json();
    });
  }

  function fetchLanguages() {
    if (!languageListPromise) {
      var url = new URL("i18n/languages.json", scriptUrl);
      languageListPromise = fetchJson(url).catch(function (error) {
        languageListPromise = null;
        throw error;
      });
    }
    return languageListPromise;
  }

  function matchLanguage(tag, list) {
    if (!tag) return "";
    var base = String(tag).toLowerCase().split("-")[0];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].code === base) return base;
    }
    return "";
  }

  /**
   * data-lang="auto": saved db-assistant:lang, then navigator.languages, then en.
   * A specific lang attribute wins over the saved choice.
   * The Addis time zone does not change this result. It only offers a suggestion
   * when nothing is saved and the language is not already Amharic.
   */
  function resolveLanguage(requested, list) {
    var value = (requested || "auto").toLowerCase();
    if (value !== "auto") return matchLanguage(value, list) || "en";
    var saved = "";
    try {
      saved = localStorage.getItem(LANG_KEY) || "";
    } catch (err) {
      saved = "";
    }
    var fromSaved = matchLanguage(saved, list);
    if (fromSaved) return fromSaved;
    var nav = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < nav.length; i += 1) {
      var found = matchLanguage(nav[i], list);
      if (found) return found;
    }
    return "en";
  }

  function storedLanguage(list) {
    var saved = "";
    try {
      saved = localStorage.getItem(LANG_KEY) || "";
    } catch (err) {
      saved = "";
    }
    return matchLanguage(saved, list);
  }

  function timeZoneDismissed() {
    try {
      return localStorage.getItem(TZ_DISMISS_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function inAddisZone() {
    try {
      return (
        Intl.DateTimeFormat().resolvedOptions().timeZone ===
        "Africa/Addis_Ababa"
      );
    } catch (err) {
      return false;
    }
  }

  function languageNativeName(list, code) {
    var items = Array.isArray(list) ? list : [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].code === code) return items[i].name;
    }
    return code;
  }

  function fetchBundle(code) {
    if (bundles.has(code)) return bundles.get(code);
    var url = new URL("i18n/" + code + ".json", scriptUrl);
    var pending = fetchJson(url).catch(function (error) {
      bundles.delete(code);
      throw error;
    });
    bundles.set(code, pending);
    return pending;
  }

  function mergeBundles(base, extra) {
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    for (key in extra) {
      if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
      var value = extra[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = {};
        var inner;
        var fromBase = base[key] || {};
        for (inner in fromBase) {
          if (Object.prototype.hasOwnProperty.call(fromBase, inner))
            out[key][inner] = fromBase[inner];
        }
        for (inner in value) {
          if (Object.prototype.hasOwnProperty.call(value, inner))
            out[key][inner] = value[inner];
        }
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  var englishPack = { commands: {}, names: {} };

  function copyStringMap(source) {
    var out = {};
    if (!source || typeof source !== "object") return out;
    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i += 1) {
      var value = source[keys[i]];
      if (Array.isArray(value)) {
        out[keys[i]] = value.map(function (item) {
          return String(item);
        });
      } else if (typeof value === "string") {
        out[keys[i]] = value;
      }
    }
    return out;
  }

  function rememberEnglish(bundle) {
    englishPack = {
      commands: copyStringMap(bundle && bundle.commands),
      names: copyStringMap(bundle && bundle.names),
    };
  }

  function loadBundles(code) {
    if (code === "en") {
      return fetchBundle("en").then(function (bundle) {
        rememberEnglish(bundle);
        return { bundle: bundle, english: bundle, fellBack: false };
      });
    }
    return Promise.all([fetchBundle("en"), fetchBundle(code)])
      .then(function (pair) {
        rememberEnglish(pair[0]);
        return {
          bundle: mergeBundles(pair[0], pair[1]),
          english: pair[0],
          fellBack: false,
        };
      })
      .catch(function () {
        return fetchBundle("en").then(function (english) {
          rememberEnglish(english);
          return { bundle: english, english: english, fellBack: true };
        });
      });
  }

  function textAt(bundle, path) {
    if (!bundle) return "";
    var node = bundle;
    var parts = path.split(".");
    for (var i = 0; i < parts.length; i += 1) {
      if (!node || typeof node !== "object") return "";
      node = node[parts[i]];
    }
    return typeof node === "string" ? node : "";
  }

  function directionOf(bundle) {
    var dir = bundle && bundle.language && bundle.language.dir;
    return dir === "rtl" ? "rtl" : "ltr";
  }

  var apiUrlMod = null;

  function loadApiUrl() {
    if (!apiUrlMod) apiUrlMod = import(new URL("api-url.js", scriptUrl));
    return apiUrlMod;
  }

  var helpModPromise = null;

  function loadHelp() {
    if (!helpModPromise) {
      helpModPromise = import(new URL("help-link.js", scriptUrl)).catch(
        function (error) {
          helpModPromise = null;
          throw error;
        },
      );
    }
    return helpModPromise;
  }

  function readOutbox() {
    try {
      var raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function writeOutbox(list) {
    try {
      if (!list || !list.length) localStorage.removeItem(OUTBOX_KEY);
      else localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-20)));
    } catch (err) {
      /* Storage can be blocked. The status for this view still shows. */
    }
  }

  function enqueueTicket(body) {
    var list = readOutbox();
    list.push({
      queuedAt: Date.now(),
      kind: body.kind,
      language: body.language,
      topic: body.topic,
      conversation: body.conversation,
      page: body.page,
      context: body.context || [],
      sentKey: body.sentKey || "",
    });
    writeOutbox(list);
  }

  function shareSaved() {
    try {
      return localStorage.getItem(SHARE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function saveShare(on) {
    try {
      if (on) localStorage.setItem(SHARE_KEY, "1");
      else localStorage.removeItem(SHARE_KEY);
    } catch (err) {
      /* The control for this visit still changes. */
    }
  }

  var calendarPromise = null;

  function loadCalendar() {
    if (!calendarPromise) {
      calendarPromise = import(new URL("calendar.js", scriptUrl)).catch(
        function (error) {
          calendarPromise = null;
          throw error;
        },
      );
    }
    return calendarPromise;
  }

  function loadProvider(name) {
    if (providers.has(name)) return providers.get(name);
    var url = new URL("providers/" + name + ".js", scriptUrl);
    var pending = import(url).catch(function (error) {
      providers.delete(name);
      throw error;
    });
    providers.set(name, pending);
    return pending;
  }

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isGreeting(value) {
    var text = String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length > 48) return false;
    var exact = {
      hi: 1,
      hii: 1,
      hiii: 1,
      hello: 1,
      helo: 1,
      hellow: 1,
      helloo: 1,
      hey: 1,
      heyy: 1,
      hiya: 1,
      yo: 1,
      sup: 1,
      "hi there": 1,
      "hey there": 1,
      "hello there": 1,
      "good morning": 1,
      "good afternoon": 1,
      "good evening": 1,
      "good night": 1,
      "how are you": 1,
      "how are u": 1,
      "how r you": 1,
      "how are you doing": 1,
      "whats up": 1,
      wassup: 1,
      thanks: 1,
      "thank you": 1,
      "thank u": 1,
      thx: 1,
      ty: 1,
      thankyou: 1,
      ok: 1,
      okay: 1,
      cool: 1,
      nice: 1,
      great: 1,
      bye: 1,
      goodbye: 1,
      "good bye": 1,
      "see you": 1,
      selam: 1,
      salaam: 1,
      salam: 1,
      "salaam alaikum": 1,
      "assalamu alaikum": 1,
      akkam: 1,
      "akkam jirta": 1,
      nagaa: 1,
      naga: 1,
      galatoomi: 1,
      salaan: 1,
      "iska warran": 1,
      mahadsanid: 1,
      ሰላም: 1,
      "ሰላም ነህ": 1,
      "ሰላም ነሽ": 1,
      "እንደምን አለህ": 1,
      "እንደምን ነህ": 1,
      "እንደምን ነሽ": 1,
      አመሰግናለሁ: 1,
      "ከመይ ኣለኻ": 1,
      "ከመይ ኣለኺ": 1,
      የቐንየለይ: 1,
      مرحبا: 1,
      اهلا: 1,
      أهلا: 1,
      "اهلا وسهلا": 1,
      "السلام عليكم": 1,
      "كيف حالك": 1,
      شكرا: 1,
      "شكرا لك": 1,
    };
    if (exact[text]) return true;
    return /^(hi+|hey+|he+l+o+w*|yo+)$/.test(text);
  }

  /** A space between two elements when the markup itself has none, but not before punctuation. */
  function needsGap(prev, next) {
    if (!prev || !next) return false;
    var left = prev.charAt(prev.length - 1);
    var right = next.charAt(0);
    if (/\s/.test(left) || /\s/.test(right)) return false;
    if (/[.,;:!?።፣)\]\}]/.test(right)) return false;
    return /[\p{L}\p{N}]/u.test(left) && /[\p{L}\p{N}]/u.test(right);
  }

  function elementText(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1 && node.nodeType !== 11) return "";
    var name = node.nodeName;
    if (name === "SCRIPT" || name === "STYLE") return "";
    var out = "";
    for (var child = node.firstChild; child; child = child.nextSibling) {
      var part = elementText(child);
      if (!part) continue;
      if (needsGap(out, part)) out += " ";
      out += part;
    }
    return out;
  }

  function slug(value) {
    var text = clean(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    return text || "section";
  }

  function normalizeSection(raw) {
    if (!raw || typeof raw !== "object") return null;
    var title = typeof raw.title === "string" ? raw.title.trim() : "";
    var text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!title && !text) return null;
    var lang = String(raw.lang || "en")
      .toLowerCase()
      .split("-")[0];
    return {
      id: String(raw.id || ""),
      title: title,
      url: String(raw.url || ""),
      text: text,
      lang: lang || "en",
    };
  }

  function sectionsFrom(data) {
    var list = data && Array.isArray(data.sections) ? data.sections : [];
    if (Array.isArray(data)) list = data;
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var section = normalizeSection(list[i]);
      if (section) out.push(section);
    }
    return out;
  }

  function dedupeSections(list) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var section = list[i];
      var key =
        (section.id || "") +
        "\n" +
        (section.url || "") +
        "\n" +
        (section.title || "");
      if (seen[key]) continue;
      seen[key] = true;
      out.push(section);
    }
    return out;
  }

  /** Same ALX FAQ and site pages the Telegram bot uses. A missing file leaves the lesson text. */
  function loadSharedKnowledge() {
    var url = new URL("/demo/data/alx-knowledge.json", location.href).href;
    return fetchJson(url)
      .then(function (data) {
        return sectionsFrom(data);
      })
      .catch(function () {
        return [];
      });
  }

  function loadContentFile(url, seen) {
    if (seen.has(url)) return Promise.resolve([]);
    seen.add(url);
    return fetchJson(url).then(function (data) {
      var own = sectionsFrom(data);
      var extra = data && Array.isArray(data.sources) ? data.sources : [];
      if (!extra.length) return own;
      var jobs = extra.map(function (src) {
        var next = new URL(src, url).href;
        return loadContentFile(next, seen).catch(function () {
          return [];
        });
      });
      return Promise.all(jobs).then(function (groups) {
        var merged = own.slice();
        for (var i = 0; i < groups.length; i += 1)
          merged = merged.concat(groups[i]);
        return merged;
      });
    });
  }

  /** Headings h1–h3 inside <main>. Missing ids are written onto the heading. */
  function scrapePage() {
    var root = document.querySelector("main") || document.body;
    var headings = Array.prototype.slice.call(
      root.querySelectorAll("h1, h2, h3"),
    );
    var used = Object.create(null);
    var sections = [];
    for (var i = 0; i < headings.length; i += 1) {
      var heading = headings[i];
      var id = heading.id;
      if (!id) {
        var nested = heading.querySelector("[id]");
        if (nested) id = nested.id;
      }
      if (!id) {
        var base = slug(heading.textContent);
        id = base;
        var n = 2;
        while (document.getElementById(id) || used[id]) {
          id = base + "-" + n;
          n += 1;
        }
        heading.id = id;
      }
      used[id] = true;
      var title = clean(heading.textContent);
      if (!title) continue;
      var next = headings[i + 1] || null;
      var text = "";
      try {
        var range = document.createRange();
        range.setStartAfter(heading);
        if (next) range.setEndBefore(next);
        else if (root.lastChild) range.setEndAfter(root.lastChild);
        text = clean(elementText(range.cloneContents()));
      } catch (err) {
        text = "";
      }
      var lang = (heading.lang || document.documentElement.lang || "en")
        .toLowerCase()
        .split("-")[0];
      sections.push({
        id: id,
        title: title,
        url: location.pathname + location.search + "#" + encodeURIComponent(id),
        text: text,
        lang: lang || "en",
      });
    }
    return sections;
  }

  function focusHost(target) {
    if (!target || typeof target.focus !== "function") return;
    var focusable = target.matches(
      "a[href], button, input, select, textarea, [tabindex]",
    );
    var added = false;
    if (!focusable && !target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
      added = true;
    }
    try {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch (err) {
      /* The host page keeps its own scroll behavior. */
    }
    target.focus();
    if (added) {
      target.addEventListener(
        "blur",
        function () {
          target.removeAttribute("tabindex");
        },
        { once: true },
      );
    }
  }

  function samePage(href) {
    try {
      var url = new URL(href, location.href);
      return (
        url.origin === location.origin && url.pathname === location.pathname
      );
    } catch (err) {
      return false;
    }
  }

  function scriptOf(text, fallback) {
    if (/[\u0600-\u06FF]/.test(text)) return "ar";
    if (/[\u1200-\u137F]/.test(text)) {
      if (fallback === "ti" || fallback === "am") return fallback;
      return "am";
    }
    return fallback || "en";
  }

  var baseFontPx = 0;

  function defaultA11y() {
    return {
      contrast: false,
      textSize: 100,
      dyslexia: false,
      spacing: 100,
      hover: false,
      cursor: false,
      links: false,
    };
  }

  /* Voice command id: [setting, value, spoken result]. */
  var VOICE_SWITCHES = {
    contrastOn: ["contrast", true, "voice.contrastOn"],
    contrastOff: ["contrast", false, "voice.contrastOff"],
    dyslexiaOn: ["dyslexia", true, "voice.dyslexiaOn"],
    dyslexiaOff: ["dyslexia", false, "voice.dyslexiaOff"],
    cursorOn: ["cursor", true, "voice.cursorOn"],
    cursorOff: ["cursor", false, "voice.cursorOff"],
    linksOn: ["links", true, "voice.linksOn"],
    linksOff: ["links", false, "voice.linksOff"],
    hoverOn: ["hover", true, "voice.hoverOn"],
    hoverOff: ["hover", false, "voice.hoverOff"],
  };

  function loadA11y() {
    var state = defaultA11y();
    try {
      var raw = localStorage.getItem(A11Y_KEY);
      if (!raw) return state;
      var parsed = JSON.parse(raw);
      state.contrast = parsed.contrast === true;
      state.dyslexia = parsed.dyslexia === true;
      state.hover = parsed.hover === true;
      state.cursor = parsed.cursor === true;
      state.links = parsed.links === true;
      var size = Math.round(Number(parsed.textSize) / 10) * 10;
      if (size >= 100 && size <= 200) state.textSize = size;
      var spacing =
        parsed.spacing === true
          ? 140
          : Math.round(Number(parsed.spacing) / 20) * 20;
      if (spacing >= 100 && spacing <= 200) state.spacing = spacing;
    } catch (err) {
      return defaultA11y();
    }
    return state;
  }

  function saveA11y(state) {
    try {
      localStorage.setItem(A11Y_KEY, JSON.stringify(state));
    } catch (err) {
      /* Storage can be blocked. The choice still applies for this view. */
    }
  }

  function commandsSaved() {
    try {
      return localStorage.getItem(COMMANDS_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function saveCommands(on) {
    try {
      if (on) localStorage.setItem(COMMANDS_KEY, "1");
      else localStorage.removeItem(COMMANDS_KEY);
    } catch (err) {
      /* The microphone state for this visit still changes. */
    }
  }

  function fill(template, map) {
    return String(template || "").replace(
      /\{([A-Za-z0-9]+)\}/g,
      function (_match, key) {
        if (!map || map[key] == null) return "";
        return String(map[key]);
      },
    );
  }

  function prefersStill() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) {
      return false;
    }
  }

  function cursorUrl(path, x, y, fallback) {
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'>" +
      "<path d='" +
      path +
      "' fill='#002b56' stroke='#ffffff' stroke-width='1.5' stroke-linejoin='round'/></svg>";
    return (
      'url("data:image/svg+xml,' +
      encodeURIComponent(svg) +
      '") ' +
      x +
      " " +
      y +
      ", " +
      fallback
    );
  }

  var BIG_ARROW = cursorUrl(
    "M4 2.5v17.2l4.6-4.4 2.9 6.6 3-1.3-2.9-6.5h6.3z",
    8,
    5,
    "auto",
  );
  var BIG_HAND = cursorUrl(
    "M9 2.8a1.6 1.6 0 0 1 3.2 0V10l.4-.1a1.6 1.6 0 0 1 3 .4l.3-.1a1.6 1.6 0 0 1 2.9.6 1.6 1.6 0 0 1 2.7 1.1V16c0 3.3-2.4 6-5.7 6h-2.3c-1.8 0-3.4-.8-4.5-2.2L4.3 14.4a1.6 1.6 0 0 1 2.4-2.1L9 14.4z",
    21,
    3,
    "pointer",
  );
  var POINTER_TARGETS =
    "a[href], button, [role='button'], [role='link'], [role='tab'], [role='switch'], label, select, summary";

  /* Pages often give links, buttons and inputs a line height of their own, so only text blocks change. */
  var SPACED_BLOCKS =
    "p, li, dd, dt, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th";

  var EFFECTS_CSS = [
    "html.db-contrast { background: #000 !important; color: #fff !important; }",
    "html.db-contrast body { background: #000 !important; color: #fff !important; }",
    "html.db-contrast body :where(:not(db-assistant, img, svg, video, canvas, picture)) {",
    "  background-color: #000 !important;",
    "  color: #fff !important;",
    "  border-color: #fff !important;",
    "}",
    "html.db-contrast body :where(a) {",
    "  color: #ffe14a !important;",
    "  background-color: #000 !important;",
    "  text-decoration: underline !important;",
    "}",
    "html.db-contrast body :where(button, input, select, textarea) {",
    "  color: #fff !important;",
    "  background-color: #000 !important;",
    "  border: 2px solid #fff !important;",
    "}",
    "html.db-dyslexia body {",
    '  font-family: "Comic Sans MS", "Comic Sans", Verdana, "Trebuchet MS", sans-serif !important;',
    "}",
    "html.db-cursor, html.db-cursor * { cursor: " +
      BIG_ARROW +
      " !important; }",
    "html.db-cursor :is(" +
      POINTER_TARGETS +
      "), html.db-cursor :is(" +
      POINTER_TARGETS +
      ") * { cursor: " +
      BIG_HAND +
      " !important; }",
    "html.db-links body a[href] {",
    "  background-color: #fff3a6 !important;",
    "  color: #002b56 !important;",
    "  text-decoration: underline !important;",
    "  text-decoration-thickness: 0.15em !important;",
    "  text-underline-offset: 0.15em !important;",
    "  outline: 2px solid #002b56 !important;",
    "  outline-offset: 1px !important;",
    "  border-radius: 0.2em;",
    "}",
    "html.db-contrast.db-links body a[href] {",
    "  background-color: #ffe14a !important;",
    "  color: #000 !important;",
    "  outline-color: #ffe14a !important;",
    "}",
    "html.db-assistant-on body {",
    "  padding-bottom: calc(max(4rem, 64px) + 2rem + env(safe-area-inset-bottom, 0px) + var(--db-launcher-lift, 0px)) !important;",
    "}",
  ].join("\n");

  function applyHostEffects(state) {
    var root = document.documentElement;
    if (!baseFontPx) {
      var measured = parseFloat(window.getComputedStyle(root).fontSize);
      baseFontPx = measured > 0 ? measured : 16;
    }
    root.classList.add("db-assistant-on");
    root.classList.toggle("db-contrast", state.contrast === true);
    root.classList.toggle("db-dyslexia", state.dyslexia === true);
    root.classList.toggle("db-spacing", state.spacing > 100);
    root.classList.toggle("db-hover", state.hover === true);
    root.classList.toggle("db-cursor", state.cursor === true);
    root.classList.toggle("db-links", state.links === true);
    var style = document.getElementById("db-a11y-effects");
    if (!style) {
      style = document.createElement("style");
      style.id = "db-a11y-effects";
      (document.head || root).appendChild(style);
    }
    var zoom = "";
    if (state.textSize > 100) {
      zoom =
        "html{font-size:" +
        Math.round((baseFontPx * state.textSize) / 100) +
        "px !important;}\n";
    }
    var spacing = "";
    if (state.spacing > 100) {
      var height = Math.round(1.5 * state.spacing) / 100;
      spacing =
        "html.db-spacing body :where(" +
        SPACED_BLOCKS +
        "){line-height:" +
        height +
        " !important;}\n";
    }
    style.textContent = zoom + spacing + EFFECTS_CSS;
  }

  var STYLE = [
    ":host {",
    "  display: block;",
    "  position: fixed;",
    "  z-index: 1050;",
    "  inset-block-end: 0;",
    "  inset-inline-start: 0;",
    "  inline-size: 0;",
    "  block-size: 0;",
    "  margin: 0;",
    "  padding: 0;",
    "  border: 0;",
    "  overflow: visible;",
    "  pointer-events: none;",
    "  background: transparent;",
    "  color: #1a1a1a;",
    '  font-family: "Noto Sans Ethiopic", var(--bs-body-font-family, system-ui), sans-serif;',
    "  font-size: 1rem;",
    "  line-height: 1.7;",
    "  letter-spacing: normal;",
    "  text-transform: none;",
    "  --db-launcher: max(4rem, 64px);",
    "  --db-edge: max(1rem, env(safe-area-inset-bottom, 0px));",
    "}",
    ".launcher, .panel, .person, .info-pop, .voice-live, .share-fixed, .share-bar { pointer-events: auto; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    "[hidden] { display: none !important; }",
    "button, select, textarea {",
    "  font: inherit;",
    "  line-height: 1.7;",
    "  letter-spacing: normal;",
    "  text-transform: none;",
    "}",
    "button { cursor: pointer; }",
    "button:focus-visible, a:focus-visible, select:focus-visible, textarea:focus-visible, input:focus-visible {",
    "  outline: 3px solid #002b56;",
    "  outline-offset: 3px;",
    "}",
    "h2, h3, p { margin: 0; }",
    "a { color: #002b56; }",
    ".launcher {",
    "  position: fixed;",
    "  z-index: 1050;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: var(--db-launcher);",
    "  block-size: var(--db-launcher);",
    "  padding: 0;",
    "  border: 0.1875rem solid #ffffff;",
    "  border-radius: 50%;",
    "  background: linear-gradient(145deg, #0a4a8a, #002b56);",
    "  color: #ffffff;",
    "  box-shadow: 0 0.5rem 1.25rem rgb(0 31 64 / 32%);",
    "  transition: transform 0.15s ease, box-shadow 0.15s ease;",
    "}",
    ".launcher[aria-expanded='true'] { box-shadow: 0 0 0 0.25rem rgb(0 43 86 / 18%), 0 0.5rem 1.25rem rgb(0 31 64 / 32%); }",
    ".launcher-chat { inset-block-end: calc(var(--db-edge) + var(--db-launcher-lift, 0px)); inset-inline-end: max(1rem, env(safe-area-inset-inline-end, 0px)); }",
    ".launcher-a11y {",
    "  inset-block-end: calc(var(--db-edge) + var(--db-a11y-lift, 0px));",
    "  inset-inline-start: var(--db-a11y-start, max(1rem, env(safe-area-inset-inline-start, 0px)));",
    "}",
    ".launcher:hover { transform: translateY(-0.125rem); box-shadow: 0 0.75rem 1.5rem rgb(0 31 64 / 36%); }",
    ".launcher svg { inline-size: 2.25rem; block-size: 2.25rem; display: block; }",
    ".launcher-a11y svg { inline-size: 2.625rem; block-size: 2.625rem; }",
    ".panel:not([open]) { display: none; }",
    ".panel[open] {",
    "  position: fixed;",
    "  z-index: 1050;",
    "  inset-block-start: auto;",
    "  inset-inline-end: max(1rem, env(safe-area-inset-inline-end, 0px));",
    "  inset-inline-start: auto;",
    "  inset-block-end: calc(var(--db-launcher) + 0.75rem + var(--db-edge) + var(--db-launcher-lift, 0px));",
    "  max-inline-size: calc(100vw - 2rem);",
    "  min-inline-size: 0;",
    "  block-size: min(60rem, calc(100dvh - var(--db-launcher) - 6rem - var(--db-launcher-lift, 0px)));",
    "  max-block-size: min(60rem, calc(100dvh - var(--db-launcher) - 6rem - var(--db-launcher-lift, 0px)));",
    "  margin: 0;",
    "  padding: 0;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0;",
    "  border: 1px solid rgb(0 43 86 / 14%);",
    "  border-radius: 1.25rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  box-shadow: 0 1.5rem 3rem -0.75rem rgb(0 20 50 / 38%), 0 0.25rem 0.75rem rgb(0 0 0 / 8%);",
    "  overflow: hidden;",
    "  overflow-wrap: anywhere;",
    "}",
    ".panel-chat[open] { inline-size: min(max(28rem, 33.333vw), 46rem, calc(100vw - 2rem)); }",
    ".panel-a11y[open] {",
    "  inset-inline-start: var(--db-a11y-start, max(1rem, env(safe-area-inset-inline-start, 0px)));",
    "  inset-inline-end: auto;",
    "  inset-block-end: calc(var(--db-launcher) + 0.75rem + var(--db-edge) + var(--db-a11y-lift, 0px));",
    "  inline-size: min(max(26rem, 25vw), 36rem, calc(100vw - 1rem - var(--db-a11y-start, 1rem)));",
    "  max-inline-size: calc(100vw - 1rem - var(--db-a11y-start, 1rem));",
    "  block-size: min(60rem, calc(100dvh - var(--db-launcher) - 6rem - var(--db-a11y-lift, 0px)));",
    "  max-block-size: min(60rem, calc(100dvh - var(--db-launcher) - 6rem - var(--db-a11y-lift, 0px)));",
    "}",
    ".panel-bar, .mode, .note, form, .speech-line, .help-row, .share-bar, .ticket-status { flex-shrink: 0; }",
    ".scroller {",
    "  flex: 1 1 auto;",
    "  min-height: 0;",
    "  min-block-size: 0;",
    "  min-inline-size: 0;",
    "  overflow-x: hidden;",
    "  overflow-y: auto;",
    "  overscroll-behavior: contain;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.625rem;",
    "  padding: 1rem;",
    "  background: #f3f6fa;",
    "  scrollbar-width: thin;",
    "  scrollbar-color: #b8c4d2 transparent;",
    "}",
    ".log {",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "}",
    ".scroller > .suggest-label, .scroller > .chips { flex-shrink: 0; }",
    ".suggest-label { color: #5c6b7a; font-size: 0.8125rem; font-weight: 600; line-height: 1.4; }",
    ".panel::backdrop { background: transparent; }",
    ".panel-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }",
    ".panel-bar h2 { flex: 1 1 8rem; min-inline-size: 0; font-size: 1.25rem; line-height: 1.7; }",
    ".panel > .panel-bar {",
    "  flex-wrap: wrap;",
    "  gap: 0.5rem 0.75rem;",
    "  padding-block: 0.75rem;",
    "  padding-inline: 1rem 0.625rem;",
    "  background: linear-gradient(135deg, #002b56 0%, #0a4a8a 100%);",
    "  color: #ffffff;",
    "}",
    ".panel-head { display: flex; flex: 1 1 7rem; flex-direction: column; min-inline-size: 0; }",
    ".panel-head h2 { flex: 0 0 auto; font-size: 1.0625rem; font-weight: 700; line-height: 1.35; color: inherit; }",
    ".brand-mark {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: 2rem;",
    "  block-size: 2rem;",
    "  color: #002b56;",
    "}",
    ".brand-mark svg { inline-size: 1.5rem; block-size: 1.5rem; display: block; }",
    ".panel > .panel-bar .brand-mark {",
    "  inline-size: 2.5rem;",
    "  block-size: 2.5rem;",
    "  border-radius: 50%;",
    "  background: rgb(255 255 255 / 16%);",
    "  color: #ffffff;",
    "}",
    ".panel-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-inline-start: auto; }",
    ".panel > .panel-bar .panel-actions { flex: 0 0 auto; flex-wrap: nowrap; align-items: center; gap: 0.375rem; }",
    ".panel-bar .talk {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  gap: 0.5rem;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.75rem 1rem;",
    "  border: 1px solid rgb(255 255 255 / 45%);",
    "  border-radius: 999px;",
    "  background: rgb(255 255 255 / 14%);",
    "  color: #ffffff;",
    "  font-size: 0.875rem;",
    "  font-weight: 600;",
    "  line-height: 1.3;",
    "  white-space: nowrap;",
    "  transition: background-color 0.15s ease, transform 0.1s ease;",
    "}",
    ".panel-bar .talk svg { inline-size: 1.25rem; block-size: 1.25rem; flex: 0 0 auto; display: block; }",
    ".panel-bar .talk:hover { background: rgb(255 255 255 / 26%); }",
    ".panel-bar .talk:active { transform: scale(0.97); }",
    ".icon-btn {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: max(2.75rem, 44px);",
    "  block-size: max(2.75rem, 44px);",
    "  padding: 0;",
    "  border: 0;",
    "  border-radius: 50%;",
    "  background: transparent;",
    "  color: inherit;",
    "  transition: background-color 0.15s ease, transform 0.1s ease;",
    "}",
    ".icon-btn svg { inline-size: 1.375rem; block-size: 1.375rem; display: block; }",
    ".icon-btn:active { transform: scale(0.94); }",
    ".panel-bar .icon-btn:hover { background: rgb(255 255 255 / 16%); }",
    ".panel > .panel-bar :focus-visible { outline-color: #ffe14a; }",
    ".text-btn, a.text-btn, .chip {",
    "  min-inline-size: 0;",
    "  max-inline-size: 100%;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.875rem;",
    "  border-radius: 0.75rem;",
    "  border: 1px solid #c3d0de;",
    "  background: #ffffff;",
    "  color: #002b56;",
    "  font-weight: 600;",
    "  text-align: start;",
    "  overflow-wrap: anywhere;",
    "  transition: background-color 0.15s ease, border-color 0.15s ease;",
    "}",
    ".text-btn:hover, a.text-btn:hover, .chip:hover { background: #eef3f9; border-color: #002b56; }",
    ".text-btn.is-primary, .a11y-reset { background: #002b56; color: #ffffff; border-color: #002b56; }",
    ".text-btn.is-primary:hover { background: #001f40; }",
    ".tab { background: transparent; }",
    "a.text-btn { display: inline-flex; align-items: center; text-decoration: none; }",
    ".chip {",
    "  border-radius: 999px;",
    "  border-color: #c9d6e3;",
    "  padding-inline: 1rem;",
    "  font-size: 0.875rem;",
    "  line-height: 1.4;",
    "  text-align: center;",
    "}",
    ".help-row {",
    "  display: flex;",
    "  flex-shrink: 0;",
    "  flex-direction: column;",
    "  gap: 0.375rem;",
    "  padding: 0.75rem;",
    "  border: 1px solid #e1e8f0;",
    "  border-radius: 1rem;",
    "  background: #ffffff;",
    "}",
    ".help-row .room {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 0.625rem;",
    "  border-radius: 0.75rem;",
    "  font-size: 0.875rem;",
    "  line-height: 1.35;",
    "}",
    ".help-row .room svg { inline-size: 1.25rem; block-size: 1.25rem; flex: 0 0 auto; }",
    ".help-row .help { color: #5c6b7a; font-size: 0.75rem; line-height: 1.45; }",
    ".person:not([open]) { display: none; }",
    ".person[open] {",
    "  position: fixed;",
    "  inset-block-start: 1rem;",
    "  inset-inline: 1rem;",
    "  inline-size: min(42rem, calc(100vw - 2rem));",
    "  max-inline-size: calc(100vw - 2rem);",
    "  max-block-size: calc(100dvh - 2rem);",
    "  max-height: calc(100dvh - 2rem);",
    "  margin-inline: auto;",
    "  margin-block: 0;",
    "  padding: 0;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0;",
    "  overflow: hidden;",
    "  overflow-wrap: anywhere;",
    "  border: 1px solid rgb(0 43 86 / 18%);",
    "  border-radius: 1.25rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  box-shadow: 0 1.5rem 3rem -0.75rem rgb(0 20 50 / 40%);",
    "  letter-spacing: normal;",
    "  text-transform: none;",
    "}",
    ".person::backdrop { background: rgb(0 20 40 / 45%); }",
    ".person-head {",
    "  display: flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "  padding-block: 0.75rem;",
    "  padding-inline: 1rem 0.5rem;",
    "  background: linear-gradient(135deg, #002b56 0%, #0a4a8a 100%);",
    "  color: #ffffff;",
    "}",
    ".person-head h2 {",
    "  flex: 1 1 auto;",
    "  min-inline-size: 0;",
    "  font-size: 1.25rem;",
    "  font-weight: 700;",
    "  line-height: 1.7;",
    "  overflow-wrap: anywhere;",
    "}",
    ".person-mark {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: 2.5rem;",
    "  block-size: 2.5rem;",
    "  border-radius: 50%;",
    "  background: rgb(255 255 255 / 16%);",
    "  color: #ffffff;",
    "}",
    ".person-mark svg { inline-size: 1.5rem; block-size: 1.5rem; display: block; }",
    ".person-head .icon-btn:hover { background: rgb(255 255 255 / 16%); }",
    ".person-head :focus-visible { outline: 3px solid #ffe14a; outline-offset: 3px; }",
    ".person-wait {",
    "  display: flex;",
    "  flex: 0 0 auto;",
    "  align-items: flex-start;",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "  margin-block: 0.75rem 0;",
    "  margin-inline: 1rem;",
    "  padding: 0.75rem 1rem;",
    "  border-radius: 1rem;",
    "  background: #e8f0fa;",
    "  color: #002b56;",
    "}",
    ".person-wait p { flex: 1 1 auto; min-inline-size: 0; line-height: 1.7; overflow-wrap: anywhere; }",
    ".person-body {",
    "  flex: 1 1 auto;",
    "  min-block-size: 0;",
    "  min-inline-size: 0;",
    "  max-height: calc(100dvh - 2rem);",
    "  overflow-x: hidden;",
    "  overflow-y: auto;",
    "  overscroll-behavior: contain;",
    "  padding-block: 0.75rem 1rem;",
    "  padding-inline: 1rem;",
    "}",
    ".person-grid {",
    "  display: grid;",
    "  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "}",
    ".option-card {",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "  padding: 1rem;",
    "  border: 1px solid #e1e8f0;",
    "  border-radius: 1rem;",
    "  background: #ffffff;",
    "  box-shadow: 0 0.25rem 0.75rem rgb(0 20 50 / 8%);",
    "  transition: border-color 0.15s ease, box-shadow 0.15s ease;",
    "}",
    ".card-top { display: flex; align-items: flex-start; gap: 0.75rem; min-inline-size: 0; }",
    ".card-copy { min-inline-size: 0; }",
    ".card-icon {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: 2.5rem;",
    "  block-size: 2.5rem;",
    "  border-radius: 0.75rem;",
    "  background: #e8f0fa;",
    "  color: #002b56;",
    "}",
    ".card-icon svg { inline-size: 1.25rem; block-size: 1.25rem; display: block; }",
    ".person[dir='rtl'] .card-icon.plane svg { transform: scaleX(-1); }",
    ".card-title { margin: 0; font-size: 1rem; font-weight: 700; line-height: 1.7; color: #002b56; overflow-wrap: anywhere; }",
    ".card-desc, .card-note, .char-hint, .person .help {",
    "  margin: 0;",
    "  color: #243140;",
    "  font-size: 0.875rem;",
    "  line-height: 1.7;",
    "  overflow-wrap: anywhere;",
    "}",
    ".person-result {",
    "  display: flex;",
    "  align-items: flex-start;",
    "  gap: 0.5rem;",
    "  margin-block-end: 0.75rem;",
    "  padding: 0.75rem;",
    "  border-radius: 1rem;",
    "}",
    ".person-result p { flex: 1 1 auto; min-inline-size: 0; margin: 0; line-height: 1.7; overflow-wrap: anywhere; }",
    ".person-result.is-status { background: #e9f6ee; color: #143d24; }",
    ".person-result.is-alert { background: #fff4f2; color: #8a1c12; }",
    ".person-result .icon-btn { color: inherit; }",
    ".option-card > .text-btn, .option-card > a.text-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 0.5rem;",
    "  inline-size: 100%;",
    "  text-align: center;",
    "  text-decoration: none;",
    "}",
    ".option-card .text-btn .spinner { inline-size: 1.25rem; block-size: 1.25rem; flex: 0 0 auto; }",
    ".option-card .text-btn:disabled {",
    "  background: #5c6b7a;",
    "  border-color: #5c6b7a;",
    "  color: #ffffff;",
    "  cursor: default;",
    "}",
    ".topic-field { display: flex; flex-direction: column; gap: 0.25rem; min-inline-size: 0; }",
    ".person-sms { padding: 0; gap: 0.75rem; }",
    ".person-sms summary {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 0.75rem;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding: 1rem;",
    "  cursor: pointer;",
    "  list-style: none;",
    "}",
    ".person-sms summary .card-title { flex: 1 1 auto; min-inline-size: 0; }",
    ".person-sms summary::-webkit-details-marker { display: none; }",
    ".person-sms summary::after {",
    "  content: \"\";",
    "  flex: 0 0 auto;",
    "  inline-size: 0.5rem;",
    "  block-size: 0.5rem;",
    "  margin-inline-start: auto;",
    "  border-block-end: 0.125rem solid currentColor;",
    "  border-inline-end: 0.125rem solid currentColor;",
    "  transform: rotate(45deg);",
    "}",
    ".person-sms[open] summary::after { transform: rotate(225deg); }",
    ".person-sms summary:focus-visible { outline: 3px solid #002b56; outline-offset: 3px; }",
    ".person-sms .card-desc, .person-sms .help, .person-sms > p { margin-inline: 1rem; }",
    ".person-sms > p:last-child { margin-block-end: 1rem; }",
    ".person-foot {",
    "  display: flex;",
    "  flex: 0 0 auto;",
    "  justify-content: flex-end;",
    "  padding-block: 0.75rem;",
    "  padding-inline: 1rem;",
    "  border-block-start: 1px solid #e1e8f0;",
    "}",
    ".person-foot .text-btn { min-inline-size: 6rem; text-align: center; }",
    ".person textarea { resize: vertical; max-inline-size: 100%; }",
    ".person:is(:lang(am), :lang(ti), :lang(ar)),",
    ".person:is(:lang(am), :lang(ti), :lang(ar)) :is(h2, h3, p, button, a, label, summary, span, option) {",
    "  line-height: 1.7;",
    "  letter-spacing: normal;",
    "  text-transform: none;",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  .person, .person * { transition: none; animation: none; scroll-behavior: auto; }",
    "}",
    ".share-bar {",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  align-items: center;",
    "  gap: 0.5rem;",
    "  padding: 0.5rem;",
    "  background: #002b56;",
    "  color: #ffffff;",
    "  max-inline-size: 100%;",
    "}",
    ".share-bar p { margin: 0; flex: 1 1 12rem; }",
    ".share-bar video { inline-size: 8rem; max-inline-size: 100%; block-size: auto; background: #000000; }",
    ".share-bar button { background: #ffffff; color: #1a1a1a; }",
    ".share-bar button:focus-visible { outline: 3px solid #ffe14a; outline-offset: 3px; }",
    ".share-fixed {",
    "  position: fixed;",
    "  z-index: 1052;",
    "  inset-block-start: 0;",
    "  inset-inline: 0;",
    "}",
    ".mode, .note, .mic-state, .speech-line, .alert, .consent p, label, legend, .help { display: block; }",
    ".lang-offer {",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: stretch;",
    "  gap: 0.5rem;",
    "  padding: 0.5rem;",
    "  border: 2px solid var(--bs-primary, #002b56);",
    "  border-radius: 0.5rem;",
    "}",
    ".mode-kind { display: block; font-weight: 700; }",
    ".mode-detail { display: block; }",
    ".panel-head .mode {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 0.375rem;",
    "  min-inline-size: 0;",
    "  font-size: 0.75rem;",
    "  line-height: 1.4;",
    "  color: rgb(255 255 255 / 82%);",
    "  white-space: nowrap;",
    "}",
    ".panel-head .mode-kind { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 0.375rem; font-weight: 600; color: #ffffff; }",
    ".panel-head .mode-kind::before {",
    '  content: "";',
    "  inline-size: 0.5rem;",
    "  block-size: 0.5rem;",
    "  border-radius: 50%;",
    "  background: #c3cdd8;",
    "}",
    ".mode[data-state='online'] .mode-kind::before { background: #3ddc84; box-shadow: 0 0 0 0.1875rem rgb(61 220 132 / 25%); }",
    ".mode[data-state='warn'] .mode-kind::before { background: #ffb547; }",
    ".panel-head .mode-detail { display: block; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; }",
    "label, legend { margin-block-end: 0.25rem; }",
    "fieldset { margin: 0; padding: 0; border: 0; min-inline-size: 0; }",
    "select, textarea {",
    "  inline-size: 100%;",
    "  max-inline-size: 100%;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.5rem;",
    "  border: 0.125rem solid #002b56;",
    "  border-radius: 0.75rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "}",
    "textarea { min-block-size: 4.5rem; resize: vertical; }",
    "form, .settings { display: flex; flex-direction: column; align-items: stretch; gap: 0.75rem; min-inline-size: 0; }",
    ".panel-chat form { gap: 0.5rem; padding-block: 0.625rem 0.75rem; padding-inline: 0.75rem; background: #ffffff; }",
    ".composer-row { display: flex; align-items: flex-end; gap: 0.5rem; min-inline-size: 0; }",
    ".input-wrap {",
    "  display: flex;",
    "  flex: 1 1 auto;",
    "  align-items: center;",
    "  min-inline-size: 0;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.125rem;",
    "  padding-inline: 1rem 0.5rem;",
    "  border: 1px solid #d5dee8;",
    "  border-radius: 1.375rem;",
    "  background: #f3f6fa;",
    "  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;",
    "}",
    ".input-wrap:focus-within { border-color: #002b56; background: #ffffff; box-shadow: 0 0 0 0.1875rem rgb(0 43 86 / 18%); }",
    ".input-wrap textarea {",
    "  display: block;",
    "  min-block-size: 0;",
    "  max-block-size: 9rem;",
    "  padding-block: 0.5rem;",
    "  padding-inline: 0;",
    "  border: 0;",
    "  border-radius: 0;",
    "  background: transparent;",
    "  line-height: 1.5;",
    "  resize: none;",
    "  overflow-y: auto;",
    "}",
    ".input-wrap textarea:focus-visible { outline: none; }",
    ".input-wrap textarea::placeholder { color: #6b7a8a; }",
    ".input-wrap textarea[aria-invalid='true'] { color: #b42318; }",
    ".input-wrap:has(textarea[aria-invalid='true']) { border-color: #b42318; }",
    ".composer-row .icon-btn { background: #eef3f9; color: #002b56; }",
    ".composer-row .icon-btn:hover { background: #dde7f2; }",
    ".composer-row .send { background: #002b56; color: #ffffff; box-shadow: 0 0.25rem 0.625rem rgb(0 43 86 / 28%); }",
    ".composer-row .send:hover { background: #001f40; }",
    ".panel[dir='rtl'] .send svg { transform: scaleX(-1); }",
    ".composer-row .listen[aria-pressed='true'] { background: #d93025; color: #ffffff; animation: db-pulse 1.4s ease-out infinite; }",
    "@keyframes db-pulse {",
    "  0% { box-shadow: 0 0 0 0 rgb(217 48 37 / 45%); }",
    "  100% { box-shadow: 0 0 0 0.75rem rgb(217 48 37 / 0%); }",
    "}",
    ".panel-chat .alert { color: #b42318; font-size: 0.8125rem; line-height: 1.45; padding-inline: 0.5rem; }",
    ".mic-state { color: #5c6b7a; font-size: 0.8125rem; line-height: 1.45; padding-inline: 0.5rem; }",
    ".mic-state:empty { display: none; }",
    "#db-consent {",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.625rem;",
    "  padding: 0.875rem;",
    "  border: 1px solid #c9d6e3;",
    "  border-radius: 1rem;",
    "  background: #f3f7fc;",
    "  font-size: 0.875rem;",
    "  line-height: 1.55;",
    "}",
    "#db-consent[hidden] { display: none; }",
    ".speech-line:not(:empty) {",
    "  padding-block: 0.5rem;",
    "  padding-inline: 1rem;",
    "  background: #e8f0fa;",
    "  color: #002b56;",
    "  font-size: 0.8125rem;",
    "  line-height: 1.45;",
    "  border-block-end: 1px solid #d5e2f0;",
    "}",
    ".ticket-status:not(:empty) { padding-block: 0.375rem 0; padding-inline: 1rem; font-size: 0.8125rem; line-height: 1.45; color: #1d4f2e; background: #ffffff; }",
    ".ticket-time { display: block; margin: 0; padding-block: 0 0.375rem; padding-inline: 1rem; font-size: 1rem; line-height: 1.7; color: #1a1a1a; }",
    ".ticket-time[hidden] { display: none; }",
    ".ticket-status:empty { display: none; }",
    ".settings { min-inline-size: 0; overflow-x: hidden; }",
    ".panel-a11y .settings {",
    "  flex: 1 1 auto;",
    "  min-height: 0;",
    "  min-block-size: 0;",
    "  overflow: hidden;",
    "  padding-block: 0.875rem 1rem;",
    "  padding-inline: 1rem;",
    "}",
    ".panel-a11y > .share-bar, .panel-a11y > .ticket-status { margin-inline: 1rem; margin-block-end: 0.75rem; }",
    ".settings h3 { font-size: 1rem; font-weight: 600; line-height: 1.7; }",
    ".settings .help { color: #3a3a3a; font-size: 0.875rem; line-height: 1.7; overflow-wrap: anywhere; }",
    ".actions, .consent-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }",
    ".actions button, .consent-actions button { flex: 1 1 8rem; }",
    ".chips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }",
    ".chip { max-inline-size: 100%; }",
    ".chip-more {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  min-inline-size: max(2.75rem, 44px);",
    "  padding-inline: 0.625rem;",
    "}",
    ".chip-more svg { inline-size: 1.25rem; block-size: 1.25rem; display: block; }",
    ".msg { display: flex; align-items: flex-end; gap: 0.5rem; min-inline-size: 0; }",
    ".msg-user { justify-content: flex-end; }",
    ".bubble {",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.25rem;",
    "  min-inline-size: 0;",
    "  max-inline-size: 85%;",
    "  padding-block: 0.625rem;",
    "  padding-inline: 0.875rem;",
    "  border-radius: 1.125rem;",
    "  line-height: 1.55;",
    "}",
    ".msg-user .bubble {",
    "  background: #002b56;",
    "  color: #ffffff;",
    "  border-end-end-radius: 0.375rem;",
    "}",
    ".msg-assistant .bubble {",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  border: 1px solid #e1e8f0;",
    "  border-end-start-radius: 0.375rem;",
    "  box-shadow: 0 1px 2px rgb(0 20 50 / 6%);",
    "}",
    ".who {",
    "  position: absolute;",
    "  inline-size: 1px;",
    "  block-size: 1px;",
    "  margin: -1px;",
    "  padding: 0;",
    "  overflow: hidden;",
    "  clip: rect(0 0 0 0);",
    "  clip-path: inset(50%);",
    "  white-space: nowrap;",
    "  border: 0;",
    "}",
    ".who-name { min-inline-size: 0; overflow-wrap: anywhere; }",
    ".avatar {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: 2rem;",
    "  block-size: 2rem;",
    "  border-radius: 50%;",
    "  background: linear-gradient(145deg, #0a4a8a, #002b56);",
    "  color: #ffffff;",
    "}",
    ".avatar svg { inline-size: 1.25rem; block-size: 1.25rem; display: block; }",
    ".msg-text { white-space: pre-wrap; overflow-wrap: anywhere; }",
    ".msg-talk { align-self: flex-start; margin-block-start: 0.25rem; }",
    ".sources-label { margin-block-start: 0.375rem; color: #5c6b7a; font-size: 0.75rem; font-weight: 700; line-height: 1.4; }",
    ".bubble .sources { font-size: 0.875rem; line-height: 1.5; }",
    ".bubble .sources a { color: #0a4a8a; }",
    ".msg-actions { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-block-start: 0.375rem; }",
    ".msg-actions button { position: relative; }",
    ".msg-actions .text-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 0.375rem;",
    "  min-block-size: 2.25rem;",
    "  padding-block: 0.125rem;",
    "  padding-inline: 0.625rem 0.75rem;",
    "  border: 0;",
    "  border-radius: 999px;",
    "  background: #eef3f9;",
    "  font-size: 0.8125rem;",
    "  line-height: 1.3;",
    "}",
    ".msg-actions .text-btn:hover { background: #dde7f2; }",
    ".msg-actions .text-btn[aria-pressed='true'] { background: #002b56; color: #ffffff; }",
    ".msg-actions svg { inline-size: 1rem; block-size: 1rem; flex: 0 0 auto; }",
    ".typing { display: flex; align-items: flex-end; gap: 0.5rem; }",
    ".typing .bubble { flex-direction: row; align-items: center; gap: 0.3rem; padding-block: 0.875rem; background: #ffffff; border: 1px solid #e1e8f0; border-end-start-radius: 0.375rem; }",
    ".typing .dot { inline-size: 0.4375rem; block-size: 0.4375rem; border-radius: 50%; background: #8a99aa; animation: db-dot 1.2s ease-in-out infinite; }",
    ".typing .dot:nth-child(2) { animation-delay: 0.15s; }",
    ".typing .dot:nth-child(3) { animation-delay: 0.3s; }",
    "@keyframes db-dot {",
    "  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }",
    "  30% { transform: translateY(-0.25rem); opacity: 1; }",
    "}",
    ".sources, .command-list { margin: 0; padding-inline-start: 1.25rem; max-inline-size: 100%; overflow-wrap: anywhere; }",
    ".alert:empty, .speech-line:empty { margin: 0; padding: 0; block-size: 0; overflow: hidden; }",
    ".tablist {",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  gap: 0.25rem;",
    "  min-inline-size: 0;",
    "  padding: 0.25rem;",
    "  border-radius: 0.875rem;",
    "  background: #eef2f7;",
    "}",
    ".tab {",
    "  flex: 1 1 0;",
    "  min-inline-size: 0;",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.375rem;",
    "  padding-inline: 0.5rem;",
    "  border: 0;",
    "  border-radius: 0.625rem;",
    "  background: transparent;",
    "  color: #3a4a5c;",
    "  font-weight: 600;",
    "  text-align: center;",
    "  line-height: 1.5;",
    "  overflow-wrap: anywhere;",
    "  transition: background-color 0.15s ease, color 0.15s ease;",
    "}",
    ".tab:hover { color: #002b56; }",
    ".tab[aria-selected='true'] {",
    "  background: #ffffff;",
    "  color: #002b56;",
    "  box-shadow: 0 1px 3px rgb(0 20 50 / 14%);",
    "}",
    ".tabpanel {",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: stretch;",
    "  gap: 0.75rem;",
    "  min-inline-size: 0;",
    "}",
    ".panel-a11y .tabpanel {",
    "  flex: 1 1 auto;",
    "  min-block-size: 0;",
    "  overflow-x: hidden;",
    "  overflow-y: auto;",
    "  padding: 0.375rem;",
    "}",
    ".is-filtered { display: none !important; }",
    ".a11y-grid {",
    "  display: grid;",
    "  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));",
    "  gap: 0.65rem;",
    "  min-inline-size: 0;",
    "}",
    ".a11y-card {",
    "  position: relative;",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 0.35rem;",
    "  min-block-size: 7rem;",
    "  min-inline-size: 0;",
    "  max-inline-size: 100%;",
    "  margin: 0;",
    "  padding: 0.75rem 0.6rem;",
    "  border: 1px solid #dbe3ec;",
    "  border-radius: 1rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  text-align: center;",
    "  line-height: 1.7;",
    "  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;",
    "}",
    "button.a11y-card:hover { border-color: #002b56; box-shadow: 0 0.375rem 1rem rgb(0 20 50 / 10%); }",
    ".a11y-card[aria-checked='true'], .a11y-card[aria-pressed='true'] {",
    "  background: #eaf2fb;",
    "  color: #1a1a1a;",
    "  border-color: #002b56;",
    "  box-shadow: 0 0.25rem 0.75rem rgb(0 43 86 / 14%);",
    "}",
    ".a11y-card > svg {",
    "  inline-size: 2.5rem;",
    "  block-size: 2.5rem;",
    "  padding: 0.5rem;",
    "  flex: 0 0 auto;",
    "  border-radius: 50%;",
    "  background: #eef3f9;",
    "  color: #002b56;",
    "}",
    ".a11y-card[aria-checked='true'] > svg { background: #002b56; color: #ffffff; }",
    ".a11y-tile { position: relative; display: flex; min-inline-size: 0; }",
    ".a11y-tile > .a11y-card { flex: 1 1 auto; inline-size: 100%; }",
    ".info-btn {",
    "  position: absolute;",
    "  z-index: 2;",
    "  inset-block-start: 0.125rem;",
    "  inset-inline-start: 0.125rem;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: max(2.75rem, 44px);",
    "  block-size: max(2.75rem, 44px);",
    "  padding: 0;",
    "  border: 0;",
    "  border-radius: 50%;",
    "  background: transparent;",
    "  color: #4a5868;",
    "  transition: background-color 0.15s ease, color 0.15s ease;",
    "}",
    ".info-btn svg { inline-size: 1.25rem; block-size: 1.25rem; display: block; }",
    ".info-btn:hover, .info-btn[aria-expanded='true'] { background: #dde7f2; color: #002b56; }",
    ".info-pop:not([open]) { display: none; }",
    ".info-pop[open] {",
    "  position: fixed;",
    "  inset: 0;",
    "  inline-size: min(28rem, calc(100vw - 2rem));",
    "  max-inline-size: calc(100vw - 2rem);",
    "  block-size: fit-content;",
    "  max-block-size: calc(100dvh - 2rem);",
    "  margin: auto;",
    "  padding: 0;",
    "  display: flex;",
    "  flex-direction: column;",
    "  overflow: hidden;",
    "  overflow-wrap: anywhere;",
    "  border: 1px solid rgb(0 43 86 / 18%);",
    "  border-radius: 1.25rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  box-shadow: 0 1.5rem 3rem -0.75rem rgb(0 20 50 / 40%);",
    "}",
    ".info-pop::backdrop { background: rgb(0 20 40 / 45%); }",
    ".info-head {",
    "  display: flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  gap: 0.75rem;",
    "  padding-block: 0.625rem;",
    "  padding-inline: 1rem 0.625rem;",
    "  background: linear-gradient(135deg, #002b56 0%, #0a4a8a 100%);",
    "  color: #ffffff;",
    "}",
    ".info-head h2 { flex: 1 1 auto; min-inline-size: 0; font-size: 1.0625rem; font-weight: 700; line-height: 1.4; }",
    ".info-head .icon-btn:hover { background: rgb(255 255 255 / 16%); }",
    ".info-head :focus-visible { outline-color: #ffe14a; }",
    ".info-body {",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.75rem;",
    "  min-block-size: 0;",
    "  overflow-y: auto;",
    "  padding: 1rem;",
    "}",
    ".info-body p { color: #2b3846; font-size: 0.9375rem; line-height: 1.7; }",
    ".info-body h3 { font-size: 0.9375rem; font-weight: 700; line-height: 1.5; color: #002b56; }",
    ".info-body .command-list { display: flex; flex-direction: column; gap: 0.25rem; line-height: 1.6; }",
    ".card-busy {",
    "  position: absolute;",
    "  inset: 0;",
    "  z-index: 1;",
    "  display: none;",
    "  align-items: center;",
    "  justify-content: center;",
    "  border-radius: inherit;",
    "  background: rgb(255 255 255 / 90%);",
    "  color: #002b56;",
    "}",
    ".is-busy > .card-busy { display: flex; }",
    ".card-busy svg { inline-size: 1.75rem; block-size: 1.75rem; display: block; }",
    ".a11y-reset { position: relative; }",
    ".spinner { transform-origin: center; }",
    "@media (prefers-reduced-motion: no-preference) {",
    "  .spinner { animation: db-spin 0.9s linear infinite; }",
    "}",
    "@keyframes db-spin { to { transform: rotate(360deg); } }",
    ".a11y-label { font-size: 0.9375rem; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }",
    ".a11y-value { color: #3a3a3a; font-size: 0.875rem; line-height: 1.5; overflow-wrap: anywhere; }",
    ".a11y-desc { color: #5c6b7a; font-size: 0.8125rem; line-height: 1.4; overflow-wrap: anywhere; }",
    ".a11y-card[aria-checked='true'] .a11y-value { color: #002b56; font-weight: 600; }",
    ".a11y-card.toggle { padding-block-start: 2rem; }",
    ".switch-ui {",
    "  position: absolute;",
    "  inset-block-start: 0.5rem;",
    "  inset-inline-end: 0.5rem;",
    "  inline-size: 2.25rem;",
    "  block-size: 1.25rem;",
    "  border: 0.125rem solid #002b56;",
    "  border-radius: 1rem;",
    "  background: #ffffff;",
    "}",
    ".switch-ui::after {",
    '  content: "";',
    "  position: absolute;",
    "  inset-block-start: 0.125rem;",
    "  inset-inline-start: 0.125rem;",
    "  inline-size: 0.75rem;",
    "  block-size: 0.75rem;",
    "  border-radius: 50%;",
    "  background: #002b56;",
    "}",
    ".a11y-card[aria-checked='true'] .switch-ui { background: #002b56; }",
    ".a11y-card[aria-checked='true'] .switch-ui::after {",
    "  background: #ffffff;",
    "  inset-inline-start: auto;",
    "  inset-inline-end: 0.125rem;",
    "}",
    ".a11y-card .stepper { justify-content: center; inline-size: 100%; }",
    ".a11y-card .step {",
    "  flex: 0 1 auto;",
    "  min-inline-size: max(2.75rem, 44px);",
    "  padding-inline: 0.5rem;",
    "  text-align: center;",
    "  font-size: 1.25rem;",
    "  font-weight: 700;",
    "  line-height: 1;",
    "}",
    ".a11y-notes { display: flex; flex-direction: column; gap: 0.5rem; margin-block-start: 0.75rem; min-inline-size: 0; }",
    ".command-box summary {",
    "  display: flex;",
    "  align-items: center;",
    "  min-block-size: max(2.75rem, 44px);",
    "  font-size: 0.875rem;",
    "  font-weight: 600;",
    "  cursor: pointer;",
    "}",
    ".command-box summary:focus-visible { outline: 3px solid #002b56; outline-offset: 3px; }",
    ".a11y-reset {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 0.5rem;",
    "  inline-size: 100%;",
    "  min-block-size: max(3rem, 48px);",
    "  margin: 0;",
    "  padding-block: 0.8rem;",
    "  padding-inline: 0.75rem;",
    "  border: 0;",
    "  border-radius: 0.65rem;",
    "  background: #002b56;",
    "  color: #ffffff;",
    "  font-weight: 600;",
    "  line-height: 1.7;",
    "  text-align: center;",
    "  overflow-wrap: anywhere;",
    "}",
    ".a11y-reset svg { inline-size: 1.25rem; block-size: 1.25rem; flex: 0 0 auto; }",
    ".stepper { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; min-inline-size: 0; }",
    ".clip {",
    "  position: absolute;",
    "  inline-size: 1px;",
    "  block-size: 1px;",
    "  padding: 0;",
    "  margin: -1px;",
    "  overflow: hidden;",
    "  clip: rect(0 0 0 0);",
    "  clip-path: inset(50%);",
    "  white-space: nowrap;",
    "  border: 0;",
    "}",
    ".voice-live {",
    "  margin: 0;",
    "  max-inline-size: min(24rem, calc(100vw - 1rem));",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  border: 1px solid rgb(0 43 86 / 20%);",
    "  border-radius: 0.875rem;",
    "  padding: 0.5rem 0.875rem;",
    "  box-shadow: 0 0.5rem 1.25rem rgb(0 20 50 / 16%);",
    "  font-size: 0.875rem;",
    "}",
    ".voice-live:not(.is-shown) {",
    "  position: absolute;",
    "  inline-size: 1px;",
    "  block-size: 1px;",
    "  padding: 0;",
    "  overflow: hidden;",
    "  clip: rect(0 0 0 0);",
    "  white-space: nowrap;",
    "  border: 0;",
    "}",
    ":host > .voice-live.is-shown {",
    "  position: fixed;",
    "  z-index: 1051;",
    "  inset-block-start: calc(max(0.5rem, env(safe-area-inset-top, 0px)) + 3.5rem);",
    "  inset-inline-end: max(0.5rem, env(safe-area-inset-inline-end, 0px));",
    "  max-block-size: 40vh;",
    "  overflow-x: hidden;",
    "  overflow-y: auto;",
    "}",
    "@media (max-width: 30rem) {",
    "  :host { --db-launcher: max(3.5rem, 56px); }",
    "  .panel-chat[open], .panel-a11y[open] {",
    "    inset-block-start: calc(max(0.5rem, env(safe-area-inset-top, 0px)) + 3.75rem);",
    "    inset-inline-start: max(0.5rem, env(safe-area-inset-inline-start, 0px));",
    "    inset-inline-end: max(0.5rem, env(safe-area-inset-inline-end, 0px));",
    "    inset-block-end: calc(var(--db-launcher) + 0.75rem + max(0.5rem, env(safe-area-inset-bottom, 0px)) + var(--db-launcher-lift, 0px));",
    "    inline-size: auto;",
    "    block-size: auto;",
    "    max-inline-size: none;",
    "    max-block-size: none;",
    "  }",
    "  .panel-a11y[open] {",
    "    inset-block-end: calc(var(--db-launcher) + 0.75rem + max(0.5rem, env(safe-area-inset-bottom, 0px)) + var(--db-a11y-lift, 0px));",
    "  }",
    "}",
    "@media (prefers-reduced-motion: no-preference) {",
    "  .scroller { scroll-behavior: smooth; }",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  .panel, .scroller, .log, .settings { scroll-behavior: auto; }",
    "  .switch-ui::after { transition: none; }",
    "  .typing .dot, .composer-row .listen[aria-pressed='true'] { animation: none; }",
    "}",
    ":host-context(html.db-cursor) * { cursor: " + BIG_ARROW + " !important; }",
    ":host-context(html.db-cursor) :is(button, a[href], select, summary, label), :host-context(html.db-cursor) :is(button, a[href]) * { cursor: " +
      BIG_HAND +
      " !important; }",
    "@media (forced-colors: active) {",
    "  .launcher, .text-btn, a.text-btn, .icon-btn, .info-btn, .chip, .talk, .panel, .person, .person-wait, .option-card, .person-result, .info-pop, select, textarea, .share-bar, .a11y-card, .a11y-reset, .tab, .avatar, .switch-ui, .bubble, .input-wrap {",
    "    border: 0.125rem solid CanvasText;",
    "  }",
    "  .input-wrap textarea { border: 0; }",
    "  .launcher, .a11y-reset, .avatar, .icon-btn, .info-btn, .talk { background: ButtonFace; color: ButtonText; }",
    "  .composer-row .send, .text-btn.is-primary {",
    "    background: ButtonText;",
    "    color: ButtonFace;",
    "  }",
    "  .msg-user .bubble, .msg-assistant .bubble { background: Canvas; color: CanvasText; }",
    "  .card-busy { background: Canvas; color: CanvasText; }",
    "  .tab[aria-selected='true'], .a11y-card[aria-checked='true'], .a11y-card[aria-pressed='true'] {",
    "    background: Canvas;",
    "    color: CanvasText;",
    "    border-color: Highlight;",
    "  }",
    "  .a11y-card[aria-checked='true'] .switch-ui { background: Highlight; }",
    "  .switch-ui::after { background: CanvasText; }",
    "}",
  ].join("\n");

  var LANG_STYLE = [
    ":host {",
    "  position: fixed;",
    "  z-index: 1051;",
    "  inset-block-start: max(0.5rem, env(safe-area-inset-top, 0px));",
    "  inset-inline-end: max(0.5rem, env(safe-area-inset-inline-end, 0px));",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: flex-end;",
    "  gap: 0.5rem;",
    "  max-inline-size: calc(100vw - 1rem - env(safe-area-inset-inline-start, 0px) - env(safe-area-inset-inline-end, 0px));",
    "  margin: 0;",
    "  padding: 0;",
    "  border: 0;",
    "  background: transparent;",
    "  color: #1a1a1a;",
    '  font-family: "Noto Sans Ethiopic", var(--bs-body-font-family, system-ui), sans-serif;',
    "  font-size: 1rem;",
    "  line-height: 1.7;",
    "  letter-spacing: normal;",
    "  text-transform: none;",
    "  overflow-wrap: anywhere;",
    "}",
    ":host([hidden]) { display: none; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    "[hidden] { display: none !important; }",
    "button, select { font: inherit; line-height: 1.7; letter-spacing: normal; text-transform: none; }",
    "button { cursor: pointer; }",
    "button:focus-visible, select:focus-visible { outline: 3px solid #002b56; outline-offset: 3px; }",
    ".lang-row {",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  justify-content: flex-end;",
    "  align-items: center;",
    "  gap: 0.5rem;",
    "  max-inline-size: min(22rem, calc(100vw - 1rem));",
    "}",
    ".lang-open {",
    "  display: none;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: max(2.75rem, 44px);",
    "  block-size: max(2.75rem, 44px);",
    "  padding: 0;",
    "  border: 1px solid rgb(0 43 86 / 16%);",
    "  border-radius: 50%;",
    "  background: #ffffff;",
    "  color: #002b56;",
    "  box-shadow: 0 0.375rem 1rem rgb(0 20 50 / 16%);",
    "}",
    ".lang-open svg { inline-size: 1.375rem; block-size: 1.375rem; display: block; }",
    ":host(.is-collapsed) .lang-open { display: inline-flex; }",
    ":host(.is-collapsed) .lang-pop { display: none; }",
    ":host(.is-collapsed.is-open) .lang-pop {",
    "  display: flex;",
    "  position: absolute;",
    "  inset-block-start: calc(100% + 0.5rem);",
    "  inset-inline-end: 0;",
    "  z-index: 1;",
    "}",
    ".lang-pop { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: flex-end; gap: 0.5rem; max-inline-size: min(22rem, 100%); }",
    // ".experiment {",
    // "  display: inline-block;",
    // "  padding-block: 0.125rem;",
    // "  padding-inline: 0.5rem;",
    // "  border: 1px solid #6b4a00;",
    // "  border-radius: 999px;",
    // "  background: #fff4d6;",
    // "  color: #3d2a00;",
    // "  font-size: 1rem;",
    // "  font-weight: 700;",
    // "  line-height: 1.4;",
    // "}",
    // ".experiment-note { margin: 0; max-inline-size: 18rem; color: #1a1a1a; font-size: 1rem; line-height: 1.7; }",
    ".lang-face {",
    "  position: relative;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 0.25rem;",
    "  min-block-size: max(2.75rem, 44px);",
    "  max-inline-size: 100%;",
    "  padding-block: 0;",
    "  padding-inline: 0.75rem 0;",
    "  border: 1px solid rgb(0 43 86 / 16%);",
    "  border-radius: 999px;",
    "  background: #ffffff;",
    "  color: #002b56;",
    "  box-shadow: 0 0.375rem 1rem rgb(0 20 50 / 14%);",
    "  transition: box-shadow 0.15s ease, border-color 0.15s ease;",
    "}",
    ".lang-face:hover { border-color: #002b56; }",
    ".lang-face:focus-within { border-color: #002b56; box-shadow: 0 0 0 0.1875rem rgb(0 43 86 / 22%), 0 0.375rem 1rem rgb(0 20 50 / 14%); }",
    ".lang-face > svg { inline-size: 1.25rem; block-size: 1.25rem; flex: 0 0 auto; color: #002b56; pointer-events: none; }",
    ".lang-face > .face-spin { display: none; }",
    ":host(.is-busy) .lang-face > .face-globe { display: none; }",
    ":host(.is-busy) .lang-face > .face-spin { display: block; }",
    "select {",
    "  min-block-size: max(2.75rem, 44px);",
    "  max-inline-size: 100%;",
    "  padding-block: 0;",
    "  padding-inline: 0.25rem 2rem;",
    "  border: 0;",
    "  border-radius: 999px;",
    "  background-color: transparent;",
    "  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23002b56' d='M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z'/%3E%3C/svg%3E\");",
    "  background-repeat: no-repeat;",
    "  background-position: right 0.625rem center;",
    "  background-size: 1.125rem;",
    "  color: #002b56;",
    "  font-weight: 600;",
    "  cursor: pointer;",
    "  appearance: none;",
    "  -webkit-appearance: none;",
    "}",
    ":host([dir='rtl']) select { background-position: left 0.625rem center; }",
    "select:focus-visible { outline: none; }",
    ".lang-toast {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 0.5rem;",
    "  max-inline-size: min(22rem, 100%);",
    "  min-block-size: 2.5rem;",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.875rem 0.375rem;",
    "  border-radius: 999px;",
    "  background: #002b56;",
    "  color: #ffffff;",
    "  font-size: 0.875rem;",
    "  box-shadow: 0 0.5rem 1.25rem rgb(0 20 50 / 25%);",
    "}",
    ".lang-toast.is-alert { background: #fff4f2; color: #8a1c12; border: 1px solid #f3c2bb; border-radius: 1rem; }",
    ".lang-busy {",
    "  display: inline-flex;",
    "  flex: 0 0 auto;",
    "  align-items: center;",
    "  justify-content: center;",
    "  inline-size: 1.25rem;",
    "  block-size: 1.25rem;",
    "  color: inherit;",
    "}",
    ".lang-busy svg, .face-spin { inline-size: 1.25rem; block-size: 1.25rem; display: block; }",
    ".spinner { transform-origin: center; }",
    "@media (prefers-reduced-motion: no-preference) {",
    "  .spinner { animation: db-spin 0.9s linear infinite; }",
    "  .lang-toast, .lang-offer, .note { animation: db-drop 0.18s ease-out; }",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  .spinner { animation: none; }",
    "}",
    ":host-context(html.db-cursor) * { cursor: " + BIG_ARROW + " !important; }",
    ":host-context(html.db-cursor) :is(button, select, label) { cursor: " +
      BIG_HAND +
      " !important; }",
    "@keyframes db-spin { to { transform: rotate(360deg); } }",
    "@keyframes db-drop { from { opacity: 0; transform: translateY(-0.375rem); } to { opacity: 1; transform: none; } }",
    ".page-status, .note, .help { margin: 0; max-inline-size: 100%; overflow-wrap: anywhere; line-height: 1.7; }",
    ".page-status { flex: 1 1 auto; min-inline-size: 0; line-height: 1.4; padding-inline-end: 0.5rem; }",
    ".page-status:empty { display: none; }",
    ".text-btn {",
    "  min-block-size: max(2.75rem, 44px);",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.875rem;",
    "  border-radius: 0.75rem;",
    "  border: 1px solid #c3d0de;",
    "  background: #ffffff;",
    "  color: #002b56;",
    "  font-weight: 600;",
    "  overflow-wrap: anywhere;",
    "}",
    ".text-btn:hover { background: #eef3f9; border-color: #002b56; }",
    ".text-btn.is-primary { background: #002b56; border-color: #002b56; color: #ffffff; }",
    ".text-btn.is-primary:hover { background: #001f40; }",
    ".lang-toast .text-btn {",
    "  flex: 0 0 auto;",
    "  min-block-size: 2rem;",
    "  padding-inline: 0.75rem;",
    "  border: 0;",
    "  border-radius: 999px;",
    "  background: rgb(255 255 255 / 16%);",
    "  color: #ffffff;",
    "  font-size: 0.8125rem;",
    "}",
    ".lang-toast .text-btn:hover { background: rgb(255 255 255 / 26%); }",
    ".lang-toast :focus-visible { outline-color: #ffe14a; }",
    ".page-consent, .lang-offer {",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: stretch;",
    "  gap: 0.5rem;",
    "  inline-size: min(20rem, 100%);",
    "  max-inline-size: min(22rem, 100%);",
    "  padding: 1rem;",
    "  border: 1px solid rgb(0 43 86 / 14%);",
    "  border-radius: 1rem;",
    "  background: #ffffff;",
    "  color: #1a1a1a;",
    "  box-shadow: 0 0.875rem 2rem rgb(0 20 50 / 22%);",
    "}",
    ".offer-title { margin: 0; color: #002b56; font-size: 1rem; font-weight: 700; line-height: 1.4; }",
    ".consent-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-block-start: 0.25rem; }",
    ".consent-actions button { flex: 1 1 6rem; text-align: center; }",
    ".help { color: #4a5868; font-size: 0.8125rem; line-height: 1.5; }",
    ".note {",
    "  padding-block: 0.25rem;",
    "  padding-inline: 0.75rem;",
    "  border-radius: 999px;",
    "  background: #e9f6ee;",
    "  color: #1d4f2e;",
    "  font-size: 0.8125rem;",
    "  font-weight: 600;",
    "  line-height: 1.5;",
    "  box-shadow: 0 0.25rem 0.75rem rgb(0 20 50 / 12%);",
    "}",
    "@media (forced-colors: active) {",
    "  .lang-face, .lang-open, select, .text-btn, .page-status, .page-consent, .lang-offer, .lang-toast, .note {",
    "    border: 0.125rem solid CanvasText;",
    "    background: Canvas;",
    "    color: CanvasText;",
    "  }",
    "  select { border: 0; }",
    "  .lang-open { background: ButtonFace; color: ButtonText; }",
    "}",
  ].join("\n");

  function button(className, type) {
    var el = document.createElement("button");
    el.type = type || "button";
    el.className = className;
    return el;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    robot: {
      rule: "evenodd",
      d: "M8.2 6.5h7.6a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2zM11.15 3.4h1.7V6.5h-1.7zM10.85 2.35a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0M3.3 9.4h1.9v3.3H3.3zM18.8 9.4h1.9v3.3h-1.9zM8.35 10.15a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0M13.35 10.15a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0M8.7 14.2h6.6v1.5H8.7z",
    },
    contrast: {
      rule: "evenodd",
      d: "M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zM12 5a7 7 0 0 1 0 14V5z",
    },
    type: {
      rule: "evenodd",
      d: "M3.5 18.5 9 4.5h2.2l5.5 14h-2.5l-1-2.6H7.1l-1 2.6H3.5zM7.8 13.6h4.6L10.1 8.2z",
    },
    dyslexia: {
      rule: "evenodd",
      d: "M12 3 5 21h3.1l1.2-2.8h5.4L16 21h3.1L12 3zM12 10.2l1.7 4h-3.4l1.7-4z",
    },
    spacing: { d: "M3 6h18v2.2H3zM3 10.9h18v2.2H3zM3 15.8h11.5v2.2H3z" },
    volume: {
      d: "M4 9.2h3.1L11.2 5.2v13.6L7.1 14.8H4zM13.4 8.3c1.6 1.1 1.6 6.3 0 7.4l-1.3-1.5c.8-.7.8-3.7 0-4.4zM15.5 6.1c2.6 1.8 2.6 10 0 11.8l-1.3-1.4c1.6-1.3 1.6-7.7 0-9z",
    },
    cursor: { d: "M5.5 2.5v16.8l4.3-4.1 2.8 6.3 2.9-1.3-2.8-6.2h6z" },
    link: {
      d: "M3.9 12c0-1.7 1.4-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.7 0-3.1-1.4-3.1-3.1zM8 13h8v-2H8zM17 7h-4v1.9h4c1.7 0 3.1 1.4 3.1 3.1s-1.4 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10z",
    },
    mic: {
      d: "M9 3.2h6a2 2 0 0 1 2 2v5.2a5 5 0 0 1-10 0V5.2a2 2 0 0 1 2-2zM11 15.5h2v2.6h2.4V20H8.6v-1.9H11z",
    },
    screen: {
      rule: "evenodd",
      d: "M3 4.2h18v11.2H3zM5.2 6.3h13.6v7H5.2zM9 16.6h6v2.1H9z",
    },
    refresh: {
      d: "M12 4.5V2L8.2 5.6 12 9.2V6.6a5.4 5.4 0 1 1-4.6 2.6l-1.9-1A7.4 7.4 0 1 0 12 4.5z",
    },
    select: {
      d: "M3 4h12v2.2H3zM3 8.9h18v2.2H3zM3 13.8h18v2.2H3zM3 18.7h9v2.2H3zM14.5 18.7H21v2.2h-6.5z",
    },
    stop: {
      rule: "evenodd",
      d: "M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zM12 4.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8zM8.6 8.6h6.8v6.8H8.6z",
    },
    send: { d: "M2.5 20.5 22 12 2.5 3.5v6.6L15 12 2.5 13.9z" },
    pin: {
      rule: "evenodd",
      d: "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zM12 6.3a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4z",
    },
    trash: {
      rule: "evenodd",
      d: "M9 2.5h6l1 1.5H20v2.2H4V4h4zM5.5 7.5h13l-1.1 13a1.6 1.6 0 0 1-1.6 1.5H8.2a1.6 1.6 0 0 1-1.6-1.5zM9.2 10v9h1.8v-9zM13 10v9h1.8v-9z",
    },
    person: {
      rule: "evenodd",
      d: "M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5zm0 1.9a7.85 7.85 0 1 1 0 15.7 7.85 7.85 0 0 1 0-15.7zM12 7a2.35 2.35 0 1 0 .01 0zM7.3 16.55c.75-2.15 2.55-3.25 4.7-3.25s3.95 1.1 4.7 3.25c.15.4-.15.75-.55.75H7.85c-.4 0-.7-.35-.55-.75z",
    },
    access: {
      rule: "evenodd",
      d: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 4.75a1.55 1.55 0 1 0 0 3.1a1.55 1.55 0 1 0 0-3.1zM6.9 8.6H17.1a0.8 0.8 0 0 1 0 1.6H13.5V13.6L15.2 18.1a0.85 0.85 0 0 1-1.55 0.7L12 14.9L10.35 18.8a0.85 0.85 0 0 1-1.55-0.7L10.5 13.6V10.2H6.9a0.8 0.8 0 0 1 0-1.6z",
    },
    more: {
      d: "M12 3.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM12 10.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM12 17.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5z",
    },
    ellipsis: {
      d: "M4.25 10.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM12 10.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM19.75 10.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5z",
    },
    globe: {
      rule: "evenodd",
      d: "M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5zm0 1.9a7.85 7.85 0 1 1 0 15.7 7.85 7.85 0 0 1 0-15.7zM12 4.4c1.7 2.1 2.6 4.6 2.6 7.6s-.9 5.5-2.6 7.6c-1.7-2.1-2.6-4.6-2.6-7.6s.9-5.5 2.6-7.6zM4.4 11.1h15.2v1.8H4.4z",
    },
    close: {
      d: "M6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z",
    },
    headset: {
      d: "M12 2a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h3v-8H5v-1a7 7 0 0 1 14 0v1h-4v8h4v1h-7v2h6a3 3 0 0 0 3-3v-9a9 9 0 0 0-9-9z",
    },
    work: {
      rule: "evenodd",
      d: "M10 2.5h4a2 2 0 0 1 2 2V6h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4.5a2 2 0 0 1 2-2zM10 4.5V6h4V4.5z",
    },
    check: { d: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" },
    message: {
      paths: [
        {
          d: "M3 5.5h18A1.5 1.5 0 0 1 22.5 7v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 17V7A1.5 1.5 0 0 1 3 5.5z",
        },
        { d: "M3.2 7.6 12 13.4l8.8-5.8 1 1.5L12 15.8 2.2 9.1z" },
      ],
    },
    info: {
      rule: "evenodd",
      d: "M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6zM12 4.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6zM11 10.2h2V17h-2zM11 7h2v2h-2z",
    },
    phone: {
      rule: "evenodd",
      d: "M8 2.2h8a2 2 0 0 1 2 2v15.6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4.2a2 2 0 0 1 2-2zm1.2 2h5.6v1.5H9.2zM12 17.2a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z",
    },
  };

  function icon(name) {
    var spec = ICONS[name] || ICONS.robot;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var parts = spec.paths || [spec];
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("fill", "currentColor");
      var rule = part.rule || spec.rule;
      if (rule) path.setAttribute("fill-rule", rule);
      path.setAttribute("d", part.d || part);
      svg.appendChild(path);
    }
    return svg;
  }

  function spinnerIcon() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("spinner");
    var track = document.createElementNS(SVG_NS, "circle");
    track.setAttribute("cx", "12");
    track.setAttribute("cy", "12");
    track.setAttribute("r", "8");
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", "currentColor");
    track.setAttribute("stroke-width", "3");
    track.setAttribute("opacity", "0.25");
    var arc = document.createElementNS(SVG_NS, "circle");
    arc.setAttribute("cx", "12");
    arc.setAttribute("cy", "12");
    arc.setAttribute("r", "8");
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", "currentColor");
    arc.setAttribute("stroke-width", "3");
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("stroke-dasharray", "18 32");
    svg.appendChild(track);
    svg.appendChild(arc);
    return svg;
  }

  function rectsOverlap(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  function sideNav() {
    return (
      document.getElementById("sidebar") || document.querySelector(".sidebar")
    );
  }

  function paragraph(className) {
    var el = document.createElement("p");
    if (className) el.className = className;
    return el;
  }

  class DbAssistant extends HTMLElement {
    constructor() {
      super();
      this._booted = false;
      this._generation = 0;
      this._bundle = null;
      this._languages = [];
      this._lang = "en";
      this._api = "";
      this._content = "";
      this._theme = "";
      this._provider = "";
      this._mode = "";
      this._serverMissed = false;
      this._cloudDown = false;
      this._aiOff = false;
      this._fallback = false;
      this._modePromise = null;
      this._modeToken = null;
      this._contentReady = null;
      this._sections = [];
      this._chipShown = CHIP_PAGE;
      this._chipLabels = {};
      this._chipAbort = null;
      this._chipToken = null;
      this._contentFailed = false;
      this._alertKey = "";
      this._noteKey = "";
      this._speechOk = false;
      this._recognition = null;
      this._recogMode = "";
      this._focusDone = false;
      this._afterClose = null;
      this._root = null;
      this._english = null;
      this._a11y = loadA11y();
      this._tts = { addis: false, gemini: false, checked: false };
      this._ttsPromise = null;
      this._commandsOn = false;
      this._commandsListening = false;
      this._commandsBlocked = false;
      this._commandLang = "";
      this._dictating = false;
      this._micKey = "";
      this._speechToken = 0;
      this._speechOn = false;
      this._activeMessage = null;
      this._statusText = "";
      this._networkFails = 0;
      this._hoverBlock = null;
      this._hoverListening = false;
      this._matchPromise = null;
      this._cloudSpeech = null;
      this._browserSpeech = null;
      this._voiceReport = "";
      this._tabIndex = 0;
      this._consentPurpose = "";
      this._offerKind = "";
      this._offerCode = "";
      this._offerGeneration = 0;
      this._areaToken = 0;
      this._areaStatusKey = "";
      this._pageState = null;
      this._pageRunning = false;
      this._pageAbort = null;
      this._pageToken = null;
      this._pageMod = null;
      this._pageStatusKey = "";
      this._pageStatusExtra = "";
      this._pageStats = null;
      this._pageWatch = null;
      this._pageUsed = 0;
      this._pageKnown = null;
      this._pageQueue = null;
      this._pageWatchBusy = false;
      this._telegram = "";
      this._telegramFromHealth = "";
      this._helpMod = null;
      this._shareOn = shareSaved();
      this._shareStream = null;
      this._sending = false;
      this._sendKind = "";
      this._ticketStatusKey = "";
      this._personStatusKey = "";
      this._helpFocusDone = true;
      this._flushing = false;
      this._onOnline = null;
      this._pageStarting = false;
      this._pageClearTimer = 0;
      this._noteTimer = 0;
      this._pendingLang = "";
      this._translateAfterLoad = "";
      this._holdPageStatus = false;
      this._pageDoneTimer = 0;
      this._a11yFocusDone = true;
      this._pageLangOpen = false;
      this._onResize = null;
    }

    static get observedAttributes() {
      return ["lang", "api", "content", "theme", "provider", "telegram"];
    }

    connectedCallback() {
      this._a11y = this._a11y || loadA11y();
      applyHostEffects(this._a11y);
      document.documentElement.classList.add("db-assistant-on");
      this._syncHover();
      this._listenOnline();
      this._listenResize();
      if (this._booted) {
        if (this._onKey) document.addEventListener("keydown", this._onKey);
        this._ensurePageLang();
        return;
      }
      this._booted = true;
      this.hidden = true;
      this._readConfig();
      this._load();
    }

    disconnectedCallback() {
      this._areaToken += 1;
      this._stopPageWork(true);
      if (this._chipAbort) this._chipAbort.abort();
      if (this._onOnline) {
        window.removeEventListener("online", this._onOnline);
        this._onOnline = null;
      }
      this._stopShare(true);
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      this._onResize = null;
      if (this._sideWatch) this._sideWatch.disconnect();
      this._sideWatch = null;
      if (this._pageDoneTimer) window.clearTimeout(this._pageDoneTimer);
      window.clearTimeout(this._pageClearTimer);
      window.clearTimeout(this._noteTimer);
      if (this._pageLangHost && this._pageLangHost.parentNode)
        this._pageLangHost.parentNode.removeChild(this._pageLangHost);
      this._pageLangHost = null;
      document.documentElement.classList.remove("db-assistant-on");
      document.documentElement.style.removeProperty("--db-launcher-lift");
      document.documentElement.style.removeProperty("--db-launcher-lift-start");
      document.documentElement.style.removeProperty("--db-launcher-lift-end");
      document.documentElement.style.removeProperty("--db-a11y-lift");
      document.documentElement.style.removeProperty("--db-a11y-start");
      if (this._onKey) document.removeEventListener("keydown", this._onKey);
      this._stopDictation();
      this._stopCommands();
      this._stopSpoken();
      this._syncHover(true);
      if (this._voiceWatch && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          this._voiceWatch,
        );
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this._booted || oldValue === newValue) return;
      this._readConfig();
      if (name === "lang") this._load();
      if (name === "content") this._reloadContent();
      if (name === "telegram" && this._person) this._syncTelegram();
      if (name === "provider" || name === "api") {
        this._mode = "";
        this._modePromise = null;
        this._modeToken = null;
        this._serverMissed = false;
        this._cloudDown = false;
        this._aiOff = false;
        this._fallback = false;
        this._tts = { addis: false, gemini: false, checked: false };
        this._ttsPromise = null;
        this._refreshMode();
      }
    }

    _readConfig() {
      this._api = this.getAttribute("api") || "";
      this._content = this.getAttribute("content") || "";
      this._theme = this.getAttribute("theme") || "";
      this._provider = (this.getAttribute("provider") || "").toLowerCase();
      this._telegram = this.getAttribute("telegram") || "";
    }

    _text(path) {
      return textAt(this._bundle, path);
    }

    _load(forced) {
      var generation = ++this._generation;
      var self = this;
      fetchLanguages()
        .then(function (list) {
          self._languages = Array.isArray(list) ? list : [];
          var requested = forced || self.getAttribute("lang") || "auto";
          var language = resolveLanguage(requested, self._languages);
          return loadBundles(language).then(function (loaded) {
            return {
              language: loaded.fellBack ? "en" : language,
              bundle: loaded.bundle,
            };
          });
        })
        .then(
          function (ready) {
            if (generation !== self._generation || !self.isConnected) return;
            self._bundle = ready.bundle;
            self._english = ready.english || ready.bundle;
            self._lang = ready.language;
            if (!self._root) self._mount();
            self._apply();
            self.hidden = false;
            if (!self._contentReady) self._reloadContent();
            self._refreshMode();
            self.dispatchEvent(
              new CustomEvent("db-assistant:language", {
                bubbles: true,
                composed: true,
                detail: { language: self._lang },
              }),
            );
          },
          function () {
            /* Strings live only in i18n JSON. Leave the shell hidden if English cannot be loaded. */
          },
        );
    }

    _reloadContent() {
      var self = this;
      var url = this._content;
      var pagePromise;
      if (!url) {
        this._contentFailed = false;
        pagePromise = Promise.resolve(scrapePage());
      } else {
        var absolute = new URL(url, location.href).href;
        pagePromise = loadContentFile(absolute, new Set()).then(
          function (sections) {
            self._contentFailed = false;
            return sections;
          },
          function () {
            self._contentFailed = true;
            return scrapePage();
          },
        );
      }
      var pending = Promise.all([pagePromise, loadSharedKnowledge()]).then(
        function (parts) {
          return dedupeSections(parts[0].concat(parts[1]));
        },
      );
      this._contentReady = pending.then(function (sections) {
        self._sections = sections;
        if (self._root) {
          self._renderChips();
          if (self._contentFailed) self._showAlert("errors.content");
        }
        return sections;
      });
    }

    /**
     * data-provider="none" stays offline. "cloud" tries the API.
     * Omitted or "auto", when data-api is set, reads GET {api}/v1/health.
     * ai:true uses the cloud provider. ai:false or a failed request stays on
     * the offline search and the status line says it is not connected.
     */
    _decideProvider() {
      if (this._mode) return Promise.resolve(this._mode);
      if (this._modePromise) return this._modePromise;
      var name = this._provider;
      var self = this;
      if (name === "cloud" || name === "none") {
        this._mode = name;
        return Promise.resolve(name);
      }
      if ((name === "auto" || name === "") && this._api) {
        var token = {};
        this._modeToken = token;
        this._modePromise = loadApiUrl()
          .then(function (mod) {
            var url = mod.apiUrl(self._api, "/v1/health", location.origin);
            return fetch(url, {
              headers: { accept: "application/json" },
              cache: "no-store",
            });
          })
          .then(function (response) {
            if (!response.ok) throw new Error("health");
            return response.json();
          })
          .then(function (body) {
            self._rememberHealth(body);
            if (self._telegramLink) self._syncTelegram();
            if (self._modeToken !== token) return self._mode || "none";
            if (body && body.ai === true) {
              self._aiOff = false;
              self._serverMissed = false;
              self._mode = "cloud";
              return "cloud";
            }
            if (body && body.ai === false) {
              self._aiOff = true;
              self._serverMissed = false;
              self._mode = "none";
              return "none";
            }
            self._serverMissed = true;
            self._mode = "none";
            return "none";
          })
          .catch(function () {
            if (self._modeToken !== token) return self._mode || "none";
            self._serverMissed = true;
            self._mode = "none";
            return "none";
          });
        return this._modePromise;
      }
      this._mode = "none";
      return Promise.resolve("none");
    }

    _refreshMode() {
      if (!this._root) return;
      var generation = this._generation;
      var self = this;
      this._decideProvider()
        .then(function (mode) {
          if (generation !== self._generation && mode !== self._mode) return;
          if (mode !== "cloud") {
            self._fallback = false;
            self._applyStatus();
            return;
          }
          return loadProvider("cloud")
            .then(function (mod) {
              return mod.prepare(self._api);
            })
            .then(function (ok) {
              self._cloudDown = !ok;
              self._fallback = false;
              self._applyStatus();
            });
        })
        .catch(function () {
          self._cloudDown = true;
          self._applyStatus();
        });
    }

    _mount() {
      var shadow = this.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = STYLE;
      shadow.appendChild(style);

      this._launcher = button("launcher launcher-chat");
      this._launcher.setAttribute("aria-haspopup", "dialog");
      this._launcher.setAttribute("aria-controls", "db-panel");
      this._launcher.setAttribute("aria-expanded", "false");
      this._launcher.appendChild(icon("robot"));

      this._a11yLauncher = button("launcher launcher-a11y");
      this._a11yLauncher.setAttribute("aria-haspopup", "dialog");
      this._a11yLauncher.setAttribute("aria-controls", "db-a11y-panel");
      this._a11yLauncher.setAttribute("aria-expanded", "false");
      this._a11yLauncher.appendChild(icon("access"));

      this._dialog = document.createElement("dialog");
      this._dialog.id = "db-panel";
      this._dialog.className = "panel panel-chat";
      this._dialog.setAttribute("role", "dialog");
      this._dialog.setAttribute("aria-modal", "false");

      this._a11yDialog = document.createElement("dialog");
      this._a11yDialog.id = "db-a11y-panel";
      this._a11yDialog.className = "panel panel-a11y";
      this._a11yDialog.setAttribute("role", "dialog");
      this._a11yDialog.setAttribute("aria-modal", "false");

      this._modeEl = paragraph("mode");
      this._modeEl.setAttribute("role", "status");
      this._modeKind = document.createElement("span");
      this._modeKind.className = "mode-kind";
      this._modeDetail = document.createElement("span");
      this._modeDetail.className = "mode-detail";
      this._modeEl.appendChild(this._modeKind);
      this._modeEl.appendChild(document.createTextNode(" "));
      this._modeEl.appendChild(this._modeDetail);

      var bar = document.createElement("div");
      bar.className = "panel-bar";
      this._title = document.createElement("h2");
      this._title.id = "db-title";
      var head = document.createElement("div");
      head.className = "panel-head";
      head.appendChild(this._title);
      head.appendChild(this._modeEl);
      var actions = document.createElement("div");
      actions.className = "panel-actions";
      this._talkBtn = button("talk");
      this._talkBtn.appendChild(icon("headset"));
      this._talkLabel = document.createElement("span");
      this._talkBtn.appendChild(this._talkLabel);
      this._closeBtn = button("icon-btn close");
      this._closeBtn.appendChild(icon("close"));
      actions.appendChild(this._talkBtn);
      actions.appendChild(this._closeBtn);
      var brand = document.createElement("span");
      brand.className = "brand-mark";
      brand.setAttribute("aria-hidden", "true");
      brand.appendChild(icon("robot"));
      bar.appendChild(brand);
      bar.appendChild(head);
      bar.appendChild(actions);

      var a11yBar = document.createElement("div");
      a11yBar.className = "panel-bar";
      this._a11yTitle = document.createElement("h2");
      this._a11yTitle.id = "db-a11y-title";
      var a11yHead = document.createElement("div");
      a11yHead.className = "panel-head";
      a11yHead.appendChild(this._a11yTitle);
      var a11yActions = document.createElement("div");
      a11yActions.className = "panel-actions";
      this._a11yClose = button("icon-btn close");
      this._a11yClose.appendChild(icon("close"));
      a11yActions.appendChild(this._a11yClose);
      var a11yMark = document.createElement("span");
      a11yMark.className = "brand-mark";
      a11yMark.setAttribute("aria-hidden", "true");
      a11yMark.appendChild(icon("access"));
      a11yBar.appendChild(a11yMark);
      a11yBar.appendChild(a11yHead);
      a11yBar.appendChild(a11yActions);

      this._mountPageLang();
      this._buildSettings();
      this._buildPerson();
      this._helpRow = document.createElement("div");
      this._helpRow.className = "help-row";
      this._roomBtn = this._makeLabeledButton("text-btn room", "work");
      this._roomBtn.setAttribute("aria-describedby", "db-room-note");
      this._roomNote = paragraph("help");
      this._roomNote.id = "db-room-note";
      this._helpRow.appendChild(this._roomBtn);
      this._helpRow.appendChild(this._roomNote);
      this._ticketStatus = paragraph("ticket-status");
      this._ticketStatus.setAttribute("role", "status");
      this._ticketTime = document.createElement("time");
      this._ticketTime.className = "ticket-time";
      this._ticketTime.hidden = true;
      this._ticketStatusA11y = paragraph("ticket-status");
      this._ticketStatusA11y.setAttribute("role", "status");
      this._ticketTimeA11y = document.createElement("time");
      this._ticketTimeA11y.className = "ticket-time";
      this._ticketTimeA11y.hidden = true;
      this._shareIn = this._makeShareBar(false);
      this._shareOut = this._makeShareBar(true);

      this._suggestLabel = paragraph("suggest-label");
      this._suggestLabel.id = "db-suggestions-label";
      this._suggestLabel.hidden = true;
      this._chips = document.createElement("div");
      this._chips.className = "chips";
      this._chips.hidden = true;
      this._chips.setAttribute("role", "group");
      this._chips.setAttribute("aria-labelledby", "db-suggestions-label");

      this._log = document.createElement("div");
      this._log.className = "log";
      this._log.setAttribute("role", "log");
      this._log.setAttribute("aria-live", "polite");
      this._log.setAttribute("aria-relevant", "additions");

      this._form = document.createElement("form");
      this._inputLabel = document.createElement("label");
      this._inputLabel.htmlFor = "db-q";
      this._inputLabel.className = "clip";
      this._input = document.createElement("textarea");
      this._input.id = "db-q";
      this._input.rows = 1;
      this._input.autocomplete = "off";
      this._alertEl = paragraph("alert");
      this._alertEl.id = "db-alert";
      this._alertEl.setAttribute("role", "alert");
      this._sendBtn = button("icon-btn send", "submit");
      this._sendBtn.appendChild(icon("send"));
      this._listenBtn = button("icon-btn listen");
      this._listenBtn.setAttribute("aria-pressed", "false");
      this._listenBtn.appendChild(icon("mic"));
      var inputWrap = document.createElement("div");
      inputWrap.className = "input-wrap";
      inputWrap.appendChild(this._input);
      var composerRow = document.createElement("div");
      composerRow.className = "composer-row";
      composerRow.appendChild(inputWrap);
      composerRow.appendChild(this._listenBtn);
      composerRow.appendChild(this._sendBtn);
      this._micState = paragraph("mic-state");
      this._micState.setAttribute("role", "status");
      this._consent = document.createElement("div");
      this._consent.id = "db-consent";
      this._consent.hidden = true;
      this._consentText = paragraph();
      var consentRow = document.createElement("div");
      consentRow.className = "consent-actions";
      this._agreeBtn = button("text-btn agree is-primary");
      this._declineBtn = button("text-btn decline");
      consentRow.appendChild(this._agreeBtn);
      consentRow.appendChild(this._declineBtn);
      this._consent.appendChild(this._consentText);
      this._consent.appendChild(consentRow);

      this._form.appendChild(this._inputLabel);
      this._form.appendChild(this._alertEl);
      this._form.appendChild(this._consent);
      this._form.appendChild(this._micState);
      this._form.appendChild(composerRow);

      var scroller = document.createElement("div");
      scroller.className = "scroller";
      scroller.appendChild(this._suggestLabel);
      scroller.appendChild(this._chips);
      scroller.appendChild(this._helpRow);
      scroller.appendChild(this._log);
      this._scroller = scroller;
      this._speechLine = paragraph("speech-line");
      this._speechLine.setAttribute("role", "status");
      this._voiceLive = paragraph("voice-live");
      this._voiceLive.setAttribute("role", "status");
      this._voiceLive.setAttribute("aria-atomic", "true");

      this._dialog.appendChild(bar);
      this._dialog.appendChild(this._speechLine);
      this._dialog.appendChild(scroller);
      this._dialog.appendChild(this._ticketStatus);
      this._dialog.appendChild(this._ticketTime);
      this._dialog.appendChild(this._form);

      this._a11yDialog.appendChild(a11yBar);
      this._a11yDialog.appendChild(this._settings);
      this._a11yDialog.appendChild(this._shareIn.root);
      this._a11yDialog.appendChild(this._ticketStatusA11y);
      this._a11yDialog.appendChild(this._ticketTimeA11y);

      shadow.appendChild(this._a11yLauncher);
      shadow.appendChild(this._launcher);
      shadow.appendChild(this._shareOut.root);
      shadow.appendChild(this._a11yDialog);
      shadow.appendChild(this._dialog);
      shadow.appendChild(this._person);
      shadow.appendChild(this._info);
      shadow.appendChild(this._voiceLive);
      this._root = shadow;
      this._bind();
      this._fillLanguages();
      this._hideIfGoogleTranslate();
      this._placeLaunchers();
    }

    _makeLabeledButton(className, iconName) {
      var el = button(className);
      el.appendChild(icon(iconName));
      var label = document.createElement("span");
      label.className = "btn-label";
      el.appendChild(label);
      el._face = { label: label };
      return el;
    }

    _fitInput() {
      if (!this._input) return;
      this._input.style.height = "auto";
      var height = this._input.scrollHeight;
      this._input.style.height = height ? Math.min(height, 144) + "px" : "";
    }

    _ensurePageLang() {
      if (this._pageLangHost && this._pageLangHost.isConnected) return;
      this._mountPageLang();
      this._fillLanguages();
      this._hideIfGoogleTranslate();
    }

    _mountPageLang() {
      var host = document.createElement("db-assistant-lang");
      var shadow = host.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = LANG_STYLE;
      shadow.appendChild(style);

      var row = document.createElement("div");
      row.className = "lang-row";
      this._langOpenBtn = button("lang-open");
      this._langOpenBtn.setAttribute("aria-haspopup", "listbox");
      this._langOpenBtn.setAttribute("aria-expanded", "false");
      this._langOpenBtn.setAttribute("aria-controls", "db-lang");
      this._langOpenBtn.appendChild(icon("globe"));

      var pop = document.createElement("div");
      pop.className = "lang-pop";
      var face = document.createElement("label");
      face.className = "lang-face";
      var globe = icon("globe");
      globe.classList.add("face-globe");
      face.appendChild(globe);
      var faceSpin = spinnerIcon();
      faceSpin.classList.add("face-spin");
      face.appendChild(faceSpin);
      this._pageExperiment = document.createElement("span");
      this._pageExperiment.className = "experiment";
      face.appendChild(this._pageExperiment);
      this._langSelect = document.createElement("select");
      this._langSelect.id = "db-lang";
      this._langSelect.setAttribute("aria-describedby", "db-page-experiment");
      face.appendChild(this._langSelect);
      pop.appendChild(face);
      this._pageExperimentNote = paragraph("experiment-note");
      this._pageExperimentNote.id = "db-page-experiment";
      pop.appendChild(this._pageExperimentNote);

      this._pageBusy = document.createElement("div");
      this._pageBusy.className = "lang-busy";
      this._pageBusy.hidden = true;
      this._pageBusy.appendChild(spinnerIcon());

      this._pageStatus = paragraph("page-status");
      this._pageStatus.setAttribute("role", "status");
      this._pageStatus.setAttribute("aria-atomic", "true");

      this._pageCancel = button("text-btn");
      this._pageCancel.hidden = true;

      row.appendChild(this._langOpenBtn);
      row.appendChild(pop);

      this._pageToast = document.createElement("div");
      this._pageToast.className = "lang-toast";
      this._pageToast.hidden = true;
      this._pageToast.appendChild(this._pageBusy);
      this._pageToast.appendChild(this._pageStatus);
      this._pageToast.appendChild(this._pageCancel);
      var toast = this._pageToast;
      var statusEl = this._pageStatus;
      new MutationObserver(function () {
        toast.hidden = !statusEl.textContent;
        toast.classList.toggle(
          "is-alert",
          statusEl.getAttribute("role") === "alert",
        );
      }).observe(statusEl, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["role"],
      });

      this._pageOriginal = button("text-btn");
      this._pageOriginal.hidden = true;

      this._offer = document.createElement("div");
      this._offer.className = "lang-offer";
      this._offer.hidden = true;
      this._offer.setAttribute("role", "status");
      this._offerText = paragraph("offer-title");
      this._offerText.id = "db-offer-title";
      this._offerGuess = paragraph("help");
      this._offerGuess.hidden = true;
      this._offerConsent = paragraph("help");
      this._offerConsent.id = "db-offer-consent";
      this._offerConsent.hidden = true;
      var offerActions = document.createElement("div");
      offerActions.className = "consent-actions";
      this._offerYes = button("text-btn is-primary");
      this._offerNo = button("text-btn");
      offerActions.appendChild(this._offerYes);
      offerActions.appendChild(this._offerNo);
      this._offer.appendChild(this._offerText);
      this._offer.appendChild(this._offerGuess);
      this._offer.appendChild(this._offerConsent);
      this._offer.appendChild(offerActions);

      this._noteEl = paragraph("note");
      this._noteEl.setAttribute("role", "status");
      this._noteEl.hidden = true;

      shadow.appendChild(row);
      shadow.appendChild(this._pageToast);
      shadow.appendChild(this._pageOriginal);
      shadow.appendChild(this._offer);
      shadow.appendChild(this._noteEl);
      this._pageLangShadow = shadow;
      this._pageLangHost = host;
      var body = document.body;
      if (body.firstChild) body.insertBefore(host, body.firstChild);
      else body.appendChild(host);
      this._wirePageLang();
    }

    _wirePageLang() {
      var self = this;
      this._langOpenBtn.addEventListener("click", function () {
        var next = !self._pageLangOpen;
        self._setPageLangOpen(next);
        if (!next) self._langOpenBtn.focus();
      });
      this._langSelect.addEventListener("change", function () {
        self._onPageLangSelect();
      });
      this._pageCancel.addEventListener("click", function () {
        self._cancelPageTranslation();
      });
      this._pageOriginal.addEventListener("click", function () {
        self._showOriginalPage();
      });
      this._offerYes.addEventListener("click", function () {
        self._acceptOffer();
      });
      this._offerNo.addEventListener("click", function () {
        self._declineOffer();
      });
    }

    _listenResize() {
      if (this._onResize) return;
      var self = this;
      this._onResize = function () {
        self._placeLaunchers();
        self._fitPageLang();
      };
      window.addEventListener("resize", this._onResize);
      var bar = sideNav();
      if (bar && window.ResizeObserver) {
        this._sideWatch = new ResizeObserver(function () {
          self._placeLaunchers();
        });
        this._sideWatch.observe(bar);
      }
    }

    _placeLaunchers() {
      var viewH =
        window.innerHeight || document.documentElement.clientHeight || 0;
      var viewW =
        window.innerWidth || document.documentElement.clientWidth || 0;
      var margin = 16;
      var rtl = this.dir === "rtl";
      var chat = this._launcher ? this._launcher.getBoundingClientRect() : null;
      var size = chat && chat.height > 0 ? chat.height : 64;
      var root = document.documentElement;

      var beside = this._sideNavEdge(viewW, viewH, rtl);
      var start = beside ? beside + 12 : margin;
      if (beside) root.style.setProperty("--db-a11y-start", start + "px");
      else root.style.removeProperty("--db-a11y-start");

      var chatLeft = rtl ? margin : viewW - margin - size;
      var a11yLeft = rtl ? viewW - start - size : start;
      var chatLift = this._obstacleLift(chatLeft, chatLeft + size, viewH, size);
      var a11yLift = this._obstacleLift(a11yLeft, a11yLeft + size, viewH, size);
      root.style.setProperty("--db-launcher-lift-end", chatLift + "px");
      root.style.setProperty("--db-launcher-lift", chatLift + "px");
      root.style.setProperty("--db-launcher-lift-start", a11yLift + "px");
      root.style.setProperty("--db-a11y-lift", a11yLift + "px");
      this._fitPageLang();
    }

    /* Distance from the start edge of the window to the far side of a fixed side nav that runs to the bottom, or 0. */
    _sideNavEdge(viewW, viewH, rtl) {
      var bar = sideNav();
      if (!bar) return 0;
      var style;
      try {
        style = window.getComputedStyle(bar);
      } catch (err) {
        return 0;
      }
      if (style.display === "none" || style.visibility === "hidden") return 0;
      var rect = bar.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8 || rect.bottom < viewH - 8)
        return 0;
      if (rect.width > viewW * 0.5) return 0;
      if (rtl)
        return rect.right >= viewW - 2 ? Math.ceil(viewW - rect.left) : 0;
      return rect.left <= 2 ? Math.ceil(rect.right) : 0;
    }

    _obstacleLift(slotLeft, slotRight, viewH, size) {
      var margin = 16;
      var slot = {
        left: slotLeft,
        right: slotRight,
        top: viewH - margin - size,
        bottom: viewH - margin,
      };
      var need = 0;
      var nodes = document.querySelectorAll("#sidebar li, .sidebar li");
      for (var i = 0; i < nodes.length; i += 1) {
        var el = nodes[i];
        var style;
        try {
          style = window.getComputedStyle(el);
        } catch (err) {
          style = null;
        }
        if (!style || style.display === "none" || style.visibility === "hidden")
          continue;
        var rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        if (rect.bottom < viewH - 8) continue;
        if (!rectsOverlap(slot, rect)) continue;
        var lift = Math.ceil(rect.height + 8);
        if (lift > need) need = lift;
      }
      return need;
    }

    _fitPageLang() {
      var host = this._pageLangHost;
      if (!host || host.hidden) return;
      var open = this._pageLangOpen;
      host.style.marginBlockStart = "";
      host.classList.remove("is-collapsed");
      host.classList.remove("is-open");
      var box = host.getBoundingClientRect();
      var nodes = document.querySelectorAll(
        "header a, header button, .header a, .header button, .header input, .header select, [role='banner'] a, [role='banner'] button",
      );
      var hit = box.width > 0 && box.width > (window.innerWidth || 0) - 24;
      var i;
      for (i = 0; i < nodes.length && !hit; i += 1) {
        var rect = nodes[i].getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rectsOverlap(box, rect)) hit = true;
      }
      if (hit) host.classList.add("is-collapsed");
      if (hit && open) {
        host.classList.add("is-open");
        this._pageLangOpen = true;
      } else if (!hit) {
        this._pageLangOpen = false;
        if (this._langOpenBtn)
          this._langOpenBtn.setAttribute("aria-expanded", "false");
      }
      if (!host.classList.contains("is-collapsed")) return;
      var btn = host.getBoundingClientRect();
      var shift = 0;
      for (i = 0; i < nodes.length; i += 1) {
        var obstacle = nodes[i].getBoundingClientRect();
        if (obstacle.width < 2 || obstacle.height < 2) continue;
        if (!rectsOverlap(btn, obstacle)) continue;
        var need = Math.ceil(obstacle.bottom - btn.top + 8);
        if (need > shift) shift = need;
      }
      if (shift > 0) host.style.marginBlockStart = shift + "px";
    }

    _setPageLangOpen(open) {
      this._pageLangOpen = open === true;
      if (this._pageLangHost)
        this._pageLangHost.classList.toggle("is-open", this._pageLangOpen);
      if (this._langOpenBtn)
        this._langOpenBtn.setAttribute(
          "aria-expanded",
          this._pageLangOpen ? "true" : "false",
        );
      if (this._pageLangOpen && this._langSelect) this._langSelect.focus();
    }

    _hideIfGoogleTranslate() {
      var self = this;
      import(new URL("page-translate.js", scriptUrl))
        .then(function (mod) {
          if (!self.isConnected) return;
          self._pageMod = mod;
          if (!mod.hostUsesGoogleTranslate(document)) return;
          if (self._pageLangHost) self._pageLangHost.hidden = true;
          if (self._offerKind === "pick") self._hideOffer();
          self._pendingLang = "";
          if (self._pageStatus) {
            self._pageStatus.textContent = "";
            self._pageStatus.setAttribute("role", "status");
          }
        })
        .catch(function () {});
    }

    _bind() {
      var self = this;
      this._onKey = function (event) {
        if (event.key !== "Escape") return;
        if (self._info && self._info.open) {
          event.preventDefault();
          self._info.close();
          return;
        }
        if (self._person && self._person.open) {
          event.preventDefault();
          self._helpFocusDone = false;
          self._person.close();
          return;
        }
        if (self._a11yDialog && self._a11yDialog.open) {
          event.preventDefault();
          self._closeA11y(false);
          return;
        }
        if (self._dialog && self._dialog.open) {
          event.preventDefault();
          self._dialog.close();
          self._finishClose();
          return;
        }
        if (self._pageLangOpen) {
          event.preventDefault();
          self._setPageLangOpen(false);
          if (self._langOpenBtn) self._langOpenBtn.focus();
        }
      };
      this._launcher.addEventListener("click", function () {
        if (self._dialog.open) {
          self._dialog.close();
          self._finishClose();
          return;
        }
        self._openChat();
      });
      this._a11yLauncher.addEventListener("click", function () {
        if (self._a11yDialog.open) {
          self._closeA11y(false);
          return;
        }
        self._openA11y();
      });
      this._a11yClose.addEventListener("click", function () {
        self._closeA11y(false);
      });
      this._a11yDialog.addEventListener("close", function () {
        self._finishA11yClose();
      });
      this._a11yDialog.addEventListener("keydown", this._onKey);
      this._closeBtn.addEventListener("click", function () {
        self._dialog.close();
        self._finishClose();
      });
      this._dialog.addEventListener("close", function () {
        self._finishClose();
      });
      this._dialog.addEventListener("keydown", this._onKey);
      document.addEventListener("keydown", this._onKey);

      this._talkBtn.addEventListener("click", function () {
        self._openHelp();
      });
      this._roomBtn.addEventListener("click", function () {
        self._askRoom();
      });
      var closePerson = function () {
        self._helpFocusDone = false;
        self._person.close();
      };
      this._personClose.addEventListener("click", closePerson);
      this._personDone.addEventListener("click", closePerson);
      this._person.addEventListener("close", function () {
        if (self._helpFocusDone) return;
        self._helpFocusDone = true;
        var back =
          self._talkBtn && self._dialog && self._dialog.open
            ? self._talkBtn
            : self._launcher;
        if (back) back.focus();
      });
      this._person.addEventListener("cancel", function (event) {
        event.preventDefault();
        self._helpFocusDone = false;
        if (self._person.open) self._person.close();
      });
      this._leaveBtn.addEventListener("click", function () {
        self._leaveMessage();
      });
      this._roomCardBtn.addEventListener("click", function () {
        self._askRoom();
      });
      this._personInput.addEventListener("input", function () {
        self._paintCharHint();
      });
      this._topicField.addEventListener("change", function () {
        self._syncTelegram();
      });
      this._personStatus._dismiss.addEventListener("click", function () {
        self._dismissPersonResult(self._personStatus._dismiss);
      });
      this._personAlert._dismiss.addEventListener("click", function () {
        self._dismissPersonResult(self._personAlert._dismiss);
      });
      this._shareStart.addEventListener("click", function () {
        self._startShare();
      });
      this._shareSend.addEventListener("click", function () {
        self._sendPage();
      });
      this._shareToggle.addEventListener("click", function () {
        self._shareOn = !self._shareOn;
        saveShare(self._shareOn);
        if (!self._shareOn) self._stopShare(true);
        self._renderShare();
        self._status(self._toggleText("screen.toggle", self._shareOn));
      });
      var stopShare = function () {
        self._stopShare(false);
      };
      this._shareIn.stop.addEventListener("click", stopShare);
      this._shareOut.stop.addEventListener("click", stopShare);

      this._tablist.addEventListener("keydown", function (event) {
        self._onTabKey(event);
      });
      this._clearBtn.addEventListener("click", function () {
        self._clearSaved();
      });
      this._areaBtn.addEventListener("click", function () {
        self._askArea();
      });
      this._form.addEventListener("submit", function (event) {
        event.preventDefault();
        self._ask();
      });
      this._input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          self._ask();
        }
      });
      this._input.addEventListener("input", function () {
        self._fitInput();
      });
      this._settings.addEventListener("click", function (event) {
        var pressed = event.target.closest("button");
        if (!pressed || !self._settings.contains(pressed)) return;
        var card = pressed.closest(".a11y-card, .a11y-reset");
        if (card && card !== self._areaBtn) self._flashBusy(card);
      });
      this._listenBtn.addEventListener("click", function () {
        self._toggleMic();
      });
      this._agreeBtn.addEventListener("click", function () {
        self._speechOk = true;
        self._consent.hidden = true;
        if (self._consentPurpose === "commands") self._toggleCommands();
        else self._startDictation();
      });
      this._commandsBtn.addEventListener("click", function () {
        self._toggleCommands();
      });
      this._contrastBtn.addEventListener("click", function () {
        var on = !self._a11y.contrast;
        self._setA11y({ contrast: on });
        self._status(self._text(on ? "voice.contrastOn" : "voice.contrastOff"));
      });
      this._dyslexiaBtn.addEventListener("click", function () {
        self._flipA11y("dyslexia", "settings.dyslexia");
      });
      this._hoverBtn.addEventListener("click", function () {
        self._flipA11y("hover", "settings.readHover");
      });
      this._cursorBtn.addEventListener("click", function () {
        var on = !self._a11y.cursor;
        self._setA11y({ cursor: on });
        self._status(self._text(on ? "voice.cursorOn" : "voice.cursorOff"));
      });
      this._linksBtn.addEventListener("click", function () {
        var on = !self._a11y.links;
        self._setA11y({ links: on });
        self._status(self._text(on ? "voice.linksOn" : "voice.linksOff"));
      });
      this._textSmaller.addEventListener("click", function () {
        self._stepText(-10);
      });
      this._textBigger.addEventListener("click", function () {
        self._stepText(10);
      });
      this._spacingLess.addEventListener("click", function () {
        self._stepSpacing(-20);
      });
      this._spacingMore.addEventListener("click", function () {
        self._stepSpacing(20);
      });
      this._readSelectedBtn.addEventListener("click", function () {
        self._readSelection("");
      });
      this._stopReadBtn.addEventListener("click", function () {
        self._hoverBlock = null;
        self._stopSpoken();
        self._status(self._text("voice.stopped"));
      });
      this._resetBtn.addEventListener("click", function () {
        self._setA11y(defaultA11y());
        self._status(self._text("settings.resetDone"));
      });
      this._declineBtn.addEventListener("click", function () {
        self._consent.hidden = true;
        self._listenBtn.focus();
      });
      this._chips.addEventListener("click", function (event) {
        var chip = event.target.closest("button");
        if (!chip || !self._chips.contains(chip)) return;
        if (chip.hasAttribute("data-more")) {
          var start = self._chipShown;
          self._chipShown += CHIP_PAGE;
          self._renderChips();
          var next = self._chips.querySelectorAll("button[data-question]");
          var focusTarget = next[start] || next[next.length - 1];
          if (focusTarget) focusTarget.focus();
          return;
        }
        var question = chip.getAttribute("data-question") || chip.textContent;
        var label = clean(chip.textContent);
        self._ask(question, label && label !== question ? label : null);
      });
      this._log.addEventListener("click", function (event) {
        var link = event.target.closest("a");
        if (!link || !self._log.contains(link)) return;
        var href = link.getAttribute("href") || "";
        if (!samePage(href)) return;
        var url = new URL(href, location.href);
        var id = decodeURIComponent(url.hash.replace(/^#/, ""));
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        if (
          target.getAttribute("aria-hidden") === "true" &&
          target.parentElement
        ) {
          target = target.parentElement;
        }
        event.preventDefault();
        self._afterHash = id;
        self._afterClose = target;
        self._focusDone = false;
        if (self._dialog.open) {
          self._dialog.close();
          self._finishClose();
        } else {
          focusHost(target);
        }
      });
    }

    _finishClose() {
      if (this._person && this._person.open) {
        this._helpFocusDone = true;
        this._person.close();
      }
      if (this._dictating) this._stopDictation();
      this._applyChrome();
      if (this._focusDone) return;
      this._focusDone = true;
      var target = this._afterClose;
      this._afterClose = null;
      if (target) {
        focusHost(target);
        if (this._afterHash && location.hash !== "#" + this._afterHash) {
          try {
            history.pushState(null, "", "#" + this._afterHash);
          } catch (err) {
            /* The section is already in view. The host URL can stay as it was. */
          }
        }
        this._afterHash = "";
        return;
      }
      this._afterHash = "";
      this._launcher.focus();
    }

    _apply() {
      var dir = directionOf(this._bundle);
      this.dir = dir;
      this._launcher.lang = this._lang;
      this._launcher.dir = dir;
      this._dialog.lang = this._lang;
      this._dialog.dir = dir;
      this._dialog.setAttribute("aria-label", this._text("panel.title"));
      if (this._a11yLauncher) {
        this._a11yLauncher.lang = this._lang;
        this._a11yLauncher.dir = dir;
      }
      if (this._a11yDialog) {
        this._a11yDialog.lang = this._lang;
        this._a11yDialog.dir = dir;
        this._a11yDialog.setAttribute(
          "aria-label",
          this._text("a11yPanel.label"),
        );
      }
      if (this._a11yTitle)
        this._a11yTitle.textContent = this._text("a11yPanel.label");
      if (this._a11yClose)
        this._labelIcon(this._a11yClose, this._text("panel.close"));
      if (this._pageLangHost) {
        this._pageLangHost.lang = this._lang;
        this._pageLangHost.dir = dir;
      }
      if (this._langSelect)
        this._labelIcon(this._langSelect, this._text("pageLang.label"));
      if (this._langOpenBtn)
        this._labelIcon(this._langOpenBtn, this._text("pageLang.label"));
      // if (this._pageExperiment) this._pageExperiment.textContent = this._text("page.experimental");
      // if (this._pageExperimentNote) this._pageExperimentNote.textContent = this._text("page.experimentalNote");
      this._fillLanguages();
      this._title.textContent = this._text("panel.title");
      this._labelIcon(this._closeBtn, this._text("panel.close"));
      this._settingsTitle.textContent = this._text("settings.title");
      this._suggestLabel.textContent = this._text("suggestions.label");
      this._renderChips();
      this._log.setAttribute("aria-label", this._text("log.label"));
      this._inputLabel.textContent = this._text("composer.label");
      this._input.placeholder = this._text("composer.label");
      this._labelIcon(this._sendBtn, this._text("composer.send"));
      this._talkLabel.textContent = this._text("escalate.talk");
      this._labelAction(this._roomBtn, this._text("escalate.accommodation"));
      this._roomNote.textContent = this._text("escalate.roomNote");
      this._syncPersonText();
      this._paintTicketStatus();
      this._renderShare();
      this._consentText.textContent = this._text("consent.speech");
      this._agreeBtn.textContent = this._text("consent.agree");
      this._declineBtn.textContent = this._text("consent.decline");
      this._paintNote();
      if (this._alertKey)
        this._alertEl.textContent = this._text(this._alertKey);
      this._applySettingsText();
      this._relabelMessages();
      this._applyChrome();
      this._applyStatus();
      this._renderMic();
      this._paintStatus();
      this._maybeTimeZoneOffer();
      if (this._commandsOn && this._commandLang !== this._lang) {
        this._commandLang = this._lang;
        this._beginCommandLoop();
      }
      this._flushOutbox();
      if (this._translateAfterLoad && this._translateAfterLoad === this._lang) {
        var translateCode = this._translateAfterLoad;
        this._translateAfterLoad = "";
        this._armPageTranslation(translateCode);
      }
      this._placeLaunchers();
    }

    _labelIcon(el, text) {
      el.setAttribute("aria-label", text);
      el.title = text;
    }

    _paintNote() {
      var self = this;
      window.clearTimeout(this._noteTimer);
      this._noteEl.textContent = this._noteKey ? this._text(this._noteKey) : "";
      this._noteEl.hidden = !this._noteKey;
      if (!this._noteKey) return;
      this._noteTimer = window.setTimeout(function () {
        self._noteKey = "";
        self._noteEl.textContent = "";
        self._noteEl.hidden = true;
      }, 2500);
    }

    _applySettingsText() {
      if (!this._tabs) return;
      this._tablist.setAttribute("aria-label", this._text("settings.tabs"));
      this._tabs[0].textContent = this._text("settings.tabAll");
      this._tabs[1].textContent = this._text("settings.tabDisplay");
      this._tabs[2].textContent = this._text("settings.tabSpeech");
      this._speechReport.lang = this._lang;
      this._commandsHelp.textContent = this._text("settings.voiceHelp");
      this._commandLabel.textContent = this._text("settings.commandList");
      this._textLabel.textContent = this._text("settings.textSize");
      this._textSmaller._face.name.textContent = this._text(
        "settings.textSmaller",
      );
      this._textBigger._face.name.textContent = this._text(
        "settings.textBigger",
      );
      this._spacingLabel.textContent = this._text("settings.spacing");
      this._spacingLess._face.name.textContent = this._text(
        "settings.spacingLess",
      );
      this._spacingMore._face.name.textContent = this._text(
        "settings.spacingMore",
      );
      this._paintDescs();
      this._hoverHelp.textContent = this._text("settings.readHoverHelp");
      this._labelAction(
        this._readSelectedBtn,
        this._text("settings.readSelected"),
      );
      this._labelAction(this._stopReadBtn, this._text("settings.stopReading"));
      this._labelAction(this._clearBtn, this._text("settings.clear"));
      this._resetHelp.textContent = this._text("settings.resetHelp");
      var resetLabel = this._resetBtn.querySelector(".btn-label");
      if (resetLabel) resetLabel.textContent = this._text("settings.reset");
      if (this._shareHelp) {
        this._shareHelp.textContent = this._text("screen.help");
        this._labelAction(this._shareStart, this._text("screen.start"));
        this._labelAction(this._shareSend, this._text("screen.sendPage"));
        this._shareSendHelp.textContent = this._text("screen.sendHelp");
      }
      if (this._areaConsent) {
        this._areaConsent.textContent = this._text("area.consent");
        this._labelAction(this._areaBtn, this._text("area.button"));
        if (this._areaStatusKey) this._setAreaStatus(this._areaStatusKey);
        this._pageCancel.textContent = this._text("page.cancel");
        this._pageOriginal.textContent = this._text("page.showOriginal");
        if (this._pageStats) this._renderPageReport();
        else if (this._pageStatusKey)
          this._setPageStatus(this._pageStatusKey, this._pageStatusExtra);
        this._syncPageButtons();
      }
      this._speechLine.lang = this._lang;
      this._voiceLive.lang = this._lang;
      this._renderA11y();
      this._renderCommands();
      this._renderCommandList();
      this._labelInfoButtons();
      this._renderSpeechReport();
      this._primeVoices();
      this._ensureTts();
    }

    _applyChrome() {
      if (!this._launcher || !this._dialog) return;
      var open = this._dialog.open;
      this._launcher.setAttribute("aria-expanded", open ? "true" : "false");
      this._launcher.setAttribute(
        "aria-label",
        this._text(open ? "launcher.close" : "launcher.open"),
      );
      this._paintStatus();
      this._syncShareBars();
      this._applyA11yChrome();
    }

    _applyA11yChrome() {
      if (!this._a11yLauncher || !this._a11yDialog) return;
      var open = this._a11yDialog.open;
      this._a11yLauncher.setAttribute("aria-expanded", open ? "true" : "false");
      this._a11yLauncher.setAttribute(
        "aria-label",
        this._text(open ? "a11yLauncher.close" : "a11yLauncher.open"),
      );
    }

    _openChat() {
      if (this._info && this._info.open) this._info.close();
      if (this._a11yDialog && this._a11yDialog.open) {
        this._a11yFocusDone = true;
        this._a11yDialog.close();
      }
      if (!this._dialog || this._dialog.open) {
        this._applyChrome();
        return;
      }
      this._focusDone = false;
      this._afterClose = null;
      this._dialog.show();
      this._applyChrome();
      if (this._closeBtn) this._closeBtn.focus();
    }

    _openA11y() {
      if (this._dialog && this._dialog.open) {
        this._focusDone = true;
        this._afterClose = null;
        this._dialog.close();
      }
      if (this._person && this._person.open) {
        this._helpFocusDone = true;
        this._person.close();
      }
      if (!this._a11yDialog || this._a11yDialog.open) {
        this._applyA11yChrome();
        return;
      }
      this._a11yFocusDone = false;
      this._a11yDialog.show();
      this._applyA11yChrome();
      this._syncShareBars();
      if (this._a11yClose) this._a11yClose.focus();
    }

    _closeA11y(skipFocus) {
      if (!this._a11yDialog || !this._a11yDialog.open) return;
      this._a11yFocusDone = skipFocus === true;
      if (this._info && this._info.open) this._info.close();
      this._a11yDialog.close();
    }

    _finishA11yClose() {
      this._applyA11yChrome();
      this._syncShareBars();
      if (this._a11yFocusDone) return;
      this._a11yFocusDone = true;
      if (this._a11yLauncher) this._a11yLauncher.focus();
    }

    _focusLangControl() {
      if (!this._langSelect) return;
      if (this._pageLangHost && this._pageLangHost.hidden) return;
      if (
        this._pageLangHost &&
        this._pageLangHost.classList.contains("is-collapsed") &&
        !this._pageLangOpen
      ) {
        if (this._langOpenBtn) this._langOpenBtn.focus();
        return;
      }
      this._langSelect.focus();
    }

    _onPageLangSelect() {
      if (
        !this._langSelect ||
        (this._pageLangHost && this._pageLangHost.hidden)
      )
        return;
      var value = this._langSelect.value;
      if (!value || value === this._pageLangValue()) {
        if (this._offerKind === "pick") this._hideOffer();
        return;
      }
      this._pendingLang = value;
      this._showOffer(value, "pick");
    }

    /** The language the page text is in now, or is about to be in. */
    _pageLangValue() {
      if (this._translateAfterLoad) return this._translateAfterLoad;
      if (this._pageState && this._pageState.target)
        return this._pageState.target;
      if ((this._pageRunning || this._pageStarting) && this._lang)
        return this._lang;
      return "en";
    }

    _commitPageLanguage(code) {
      var wasTranslated = !!(this._pageState || this._pageRunning);
      this._pendingLang = "";
      this._hideOffer();
      try {
        localStorage.setItem(LANG_KEY, code);
      } catch (err) {
        /* The choice still applies for this view. */
      }
      this._noteKey = "status.saved";
      this._translateAfterLoad = code;
      if (wasTranslated) {
        this._holdPageStatus = true;
        this._showOriginalPage();
        this._holdPageStatus = false;
      }
      var hostShown = !(this._pageLangHost && this._pageLangHost.hidden);
      if (code !== "en" && hostShown) {
        this._pageStarting = true;
        this._pageStats = null;
        this._setPageStatus("pageLang.translating");
      } else if (wasTranslated) {
        this._setPageStatus("page.restored");
      } else {
        this._setPageStatus("");
      }
      this._syncPageButtons();
      this._load(code);
    }

    _armPageTranslation(code) {
      if ((this._pageLangHost && this._pageLangHost.hidden) || code === "en") {
        this._pageStarting = false;
        this._syncPageButtons();
        return;
      }
      this._startPageTranslation();
    }

    _applyStatus() {
      if (!this._modeKind) return;
      var kind = "status.offline";
      var detail = "status.offlineMode";
      if (
        this._mode === "cloud" &&
        !this._cloudDown &&
        !this._fallback &&
        !this._aiOff
      ) {
        kind = "status.connected";
        detail = "status.connectedMode";
      } else if (this._fallback) {
        kind = "status.notConnected";
        detail = "status.modelFailed";
      } else if (
        this._mode === "cloud" ||
        this._serverMissed ||
        this._cloudDown ||
        this._aiOff
      ) {
        kind = "status.notConnected";
        detail = "status.offlineMode";
      }
      this._modeKind.textContent = this._text(kind);
      this._modeDetail.textContent = this._text(detail);
      this._modeEl.title = this._text(detail);
      var state = "offline";
      if (kind === "status.connected") state = "online";
      else if (kind === "status.notConnected") state = "warn";
      this._modeEl.setAttribute("data-state", state);
    }

    _fillLanguages() {
      if (!this._langSelect) return;
      if (!this._langSelect.querySelector("[data-lang-option]")) {
        for (var i = 0; i < this._languages.length; i += 1) {
          var item = this._languages[i];
          var option = document.createElement("option");
          option.value = item.code;
          option.lang = item.code;
          option.dir = item.dir === "rtl" ? "rtl" : "ltr";
          option.dataset.langOption = "1";
          option.textContent = item.name;
          this._langSelect.appendChild(option);
        }
      }
      this._syncPageLangSelect();
    }

    _syncPageLangSelect() {
      if (!this._langSelect) return;
      var value = this._pendingLang || this._pageLangValue();
      var has = false;
      var options = this._langSelect.options || [];
      for (var i = 0; i < options.length; i += 1) {
        if (options[i].value === value) has = true;
      }
      this._langSelect.value = has ? value : "en";
    }

    _topicSections() {
      var topics = [];
      var list = this._sections || [];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].title) topics.push(list[i]);
      }
      return topics;
    }

    _chipLabel(lang, title) {
      var saved = this._chipLabels && this._chipLabels[lang];
      return (saved && saved[title]) || title;
    }

    _rememberChipLabel(lang, title, label) {
      if (!lang || !title || !label) return;
      if (!this._chipLabels) this._chipLabels = {};
      if (!this._chipLabels[lang]) this._chipLabels[lang] = {};
      this._chipLabels[lang][title] = label;
    }

    _paintChipLabel(title, label, lang) {
      if (!this._chips || !label) return;
      var dir = directionOf(this._bundle) || "auto";
      var buttons = this._chips.querySelectorAll("button[data-question]");
      for (var i = 0; i < buttons.length; i += 1) {
        if (buttons[i].getAttribute("data-question") !== title) continue;
        buttons[i].textContent = label;
        buttons[i].lang = lang;
        buttons[i].dir = dir;
      }
    }

    /** Visible topic titles follow the selected language. The question sent stays the original title. */
    _translateChips(topics, lang) {
      var self = this;
      if (this._chipAbort) this._chipAbort.abort();
      this._chipAbort = null;
      if (!lang || lang === "en" || !topics.length || !this._api) return;
      var token = {};
      this._chipToken = token;
      var titles = [];
      var seen = Object.create(null);
      for (var i = 0; i < topics.length; i += 1) {
        var title = topics[i].title;
        if (!title || seen[title]) continue;
        seen[title] = true;
        if (topics[i].lang && topics[i].lang === lang) continue;
        titles.push(title);
      }
      if (!titles.length) return;
      var controller = new AbortController();
      this._chipAbort = controller;
      import(new URL("page-translate.js", scriptUrl))
        .then(function (mod) {
          if (self._chipToken !== token || self._lang !== lang) return null;
          var missing = [];
          for (var n = 0; n < titles.length; n += 1) {
            var known = self._chipLabel(lang, titles[n]);
            if (known !== titles[n]) {
              self._paintChipLabel(titles[n], known, lang);
              continue;
            }
            var cached = mod.readPageCache(lang, titles[n]);
            if (cached) {
              self._rememberChipLabel(lang, titles[n], cached);
              self._paintChipLabel(titles[n], cached, lang);
              continue;
            }
            missing.push(titles[n]);
          }
          if (!missing.length) return null;
          return self
            ._postTranslate(missing, controller.signal, lang)
            .then(function (texts) {
              if (
                self._chipToken !== token ||
                self._lang !== lang ||
                !Array.isArray(texts)
              )
                return;
              for (var t = 0; t < missing.length; t += 1) {
                var value = typeof texts[t] === "string" ? texts[t].trim() : "";
                if (!value) continue;
                mod.writePageCache(lang, missing[t], value);
                self._rememberChipLabel(lang, missing[t], value);
                self._paintChipLabel(missing[t], value, lang);
              }
            });
        })
        .catch(function () {
          /* Topics stay in their original language when translation is unavailable. */
        });
    }

    _renderChips() {
      if (!this._chips) return;
      var topics = this._topicSections();
      var lang = this._lang || "en";
      var shown = this._chipShown;
      if (!shown || shown < CHIP_PAGE) shown = CHIP_PAGE;
      if (shown > topics.length) shown = topics.length;
      this._chipShown = shown || CHIP_PAGE;
      var visible = topics.slice(0, shown);
      var translatedDir = directionOf(this._bundle) || "auto";
      this._chips.replaceChildren();
      for (var i = 0; i < visible.length; i += 1) {
        var section = visible[i];
        var label =
          lang === "en" ? section.title : this._chipLabel(lang, section.title);
        var translated = label !== section.title;
        var chip = button("chip");
        chip.lang = translated ? lang : section.lang || "en";
        chip.dir = translated ? translatedDir : "auto";
        chip.textContent = label;
        chip.setAttribute("data-question", section.title);
        this._chips.appendChild(chip);
      }
      if (topics.length > shown) {
        var more = button("chip chip-more");
        more.setAttribute("data-more", "1");
        more.appendChild(icon("ellipsis"));
        this._labelIcon(more, this._text("suggestions.more"));
        this._chips.appendChild(more);
      }
      var hasChips = this._chips.childElementCount > 0;
      this._chips.hidden = !hasChips;
      this._suggestLabel.hidden = !hasChips;
      if (lang === "en") {
        if (this._chipAbort) this._chipAbort.abort();
        this._chipAbort = null;
      } else {
        this._translateChips(visible, lang);
      }
    }

    _showAlert(key) {
      this._alertKey = key || "";
      if (!this._alertEl) return;
      this._alertEl.textContent = key ? this._text(key) : "";
      if (key === "errors.empty") {
        this._input.setAttribute("aria-invalid", "true");
        this._input.setAttribute("aria-describedby", "db-alert");
      } else {
        this._input.removeAttribute("aria-invalid");
        this._input.removeAttribute("aria-describedby");
      }
    }

    _ask(preset, shown) {
      var question = clean(preset != null ? preset : this._input.value);
      var visible = clean(shown != null ? shown : question) || question;
      if (!question) {
        this._showAlert("errors.empty");
        this._input.focus();
        return;
      }
      this._showAlert("");
      if (preset == null) {
        this._input.value = "";
        this._fitInput();
      }
      var language = this._lang;
      this._appendMessage({
        role: "user",
        kind: "user",
        text: visible,
        lang: scriptOf(visible, language),
      });
      this.dispatchEvent(
        new CustomEvent("db-assistant:question", {
          bubbles: true,
          composed: true,
          detail: { text: visible, language: language },
        }),
      );
      var self = this;
      var typing = this._showTyping();
      loadProvider("advice")
        .then(function (advice) {
          if (!advice.isAdviceQuestion(question)) return null;
          return {
            text: self._text("errors.advice"),
            sources: [],
            mode: "advice",
          };
        })
        .then(function (refused) {
          if (refused) return refused;
          return Promise.resolve(self._contentReady).then(function (sections) {
            return self._answer(question, sections || [], language);
          });
        })
        .then(function (result) {
          typing.remove();
          self._showResult(result, language);
        })
        .catch(function () {
          typing.remove();
          self._showAlert("errors.generic");
        });
    }

    _showTyping() {
      var row = document.createElement("div");
      row.className = "typing";
      row.setAttribute("aria-hidden", "true");
      var avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.appendChild(icon("robot"));
      var bubble = document.createElement("div");
      bubble.className = "bubble";
      for (var i = 0; i < 3; i += 1) {
        var dot = document.createElement("span");
        dot.className = "dot";
        bubble.appendChild(dot);
      }
      row.appendChild(avatar);
      row.appendChild(bubble);
      this._log.appendChild(row);
      this._scrollToEnd();
      return row;
    }

    _scrollToEnd() {
      if (this._scroller)
        this._scroller.scrollTop = this._scroller.scrollHeight;
    }

    async _answer(question, sections, language) {
      if (isGreeting(question)) {
        return {
          text: this._text("errors.greeting"),
          sources: [],
          mode: "greeting",
        };
      }
      var advice = await loadProvider("advice");
      if (advice.isAdviceQuestion(question)) {
        return {
          text: this._text("errors.advice"),
          sources: [],
          mode: "advice",
        };
      }
      var mode = await this._decideProvider();
      if (mode === "cloud") {
        try {
          var cloud = await loadProvider("cloud");
          var ready =
            cloud.connected === true || (await cloud.prepare(this._api));
          if (!ready) {
            this._cloudDown = true;
            this._fallback = false;
            this._applyStatus();
          } else {
            var cloudAnswer = await cloud.answer(
              question,
              sections,
              language,
              this._api,
            );
            if (cloudAnswer && cloudAnswer.text) {
              this._fallback = cloudAnswer.mode === "offline-fallback";
              this._aiOff = cloudAnswer.mode === "offline";
              this._cloudDown = this._fallback || this._aiOff;
              this._applyStatus();
              return cloudAnswer;
            }
            if (cloudAnswer && cloudAnswer.mode === "not-found") {
              this._cloudDown = false;
              this._fallback = false;
              this._aiOff = false;
              this._applyStatus();
              return cloudAnswer;
            }
            this._cloudDown = true;
            this._fallback = false;
            this._applyStatus();
          }
        } catch (err) {
          this._cloudDown = true;
          this._fallback = false;
          this._applyStatus();
        }
      }
      var none = await loadProvider("none");
      return none.answer(question, sections, language);
    }

    _showResult(result, language) {
      if (result && result.mode === "advice") {
        this._appendMessage({
          role: "assistant",
          kind: "advice",
          lang: language,
        });
        return;
      }
      if (!result || result.text == null) {
        this._appendMessage({
          role: "assistant",
          kind: "miss",
          lang: language,
        });
        return;
      }
      var lang = language;
      var sources = Array.isArray(result.sources) ? result.sources : [];
      if (sources.length) {
        var url = sources[0].url;
        for (var i = 0; i < this._sections.length; i += 1) {
          if (this._sections[i].url === url && this._sections[i].lang) {
            lang = this._sections[i].lang;
            break;
          }
        }
      }
      this._appendMessage({
        role: "assistant",
        kind: "hit",
        text: result.text,
        lang: lang,
        sources: sources,
      });
    }

    _appendMessage(meta) {
      var item = document.createElement("div");
      item.className =
        meta.role === "assistant" ? "msg msg-assistant" : "msg msg-user";
      item.lang = meta.lang || this._lang;
      item._meta = meta;
      var who = paragraph("who");
      var whoName = document.createElement("span");
      whoName.className = "who-name";
      if (meta.role === "assistant") {
        var avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.appendChild(icon("robot"));
        item.appendChild(avatar);
      }
      who.appendChild(whoName);
      var bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.dir = "auto";
      var text = paragraph("msg-text");
      text.dir = "auto";
      bubble.appendChild(who);
      bubble.appendChild(text);
      if (meta.kind === "miss" || meta.kind === "advice") {
        var offer = button("text-btn msg-talk");
        bubble.appendChild(offer);
        var selfOffer = this;
        offer.addEventListener("click", function () {
          selfOffer._openHelp();
        });
      }
      item.appendChild(bubble);
      if (meta.kind === "hit" && meta.sources && meta.sources.length) {
        var label = paragraph("sources-label");
        var list = document.createElement("ul");
        list.className = "sources";
        for (var i = 0; i < meta.sources.length; i += 1) {
          var source = meta.sources[i];
          var li = document.createElement("li");
          var link = document.createElement("a");
          link.href = source.url || "#";
          link.textContent = source.title || source.url || "";
          link.lang = meta.lang || this._lang;
          link.dir = "auto";
          li.appendChild(link);
          list.appendChild(li);
        }
        bubble.appendChild(label);
        bubble.appendChild(list);
      }
      if (meta.role === "assistant") {
        var actions = document.createElement("div");
        actions.className = "msg-actions";
        var listen = button("text-btn msg-listen");
        listen.setAttribute("aria-pressed", "false");
        listen.appendChild(icon("volume"));
        var listenLabel = document.createElement("span");
        listenLabel.className = "btn-label";
        var listenClip = document.createElement("span");
        listenClip.className = "clip";
        listen.appendChild(listenLabel);
        listen.appendChild(document.createTextNode(" "));
        listen.appendChild(listenClip);
        var stopSpeak = button("text-btn msg-stop");
        stopSpeak.appendChild(icon("stop"));
        var stopLabel = document.createElement("span");
        stopLabel.className = "btn-label";
        var stopClip = document.createElement("span");
        stopClip.className = "clip";
        stopSpeak.appendChild(stopLabel);
        stopSpeak.appendChild(document.createTextNode(" "));
        stopSpeak.appendChild(stopClip);
        actions.appendChild(listen);
        actions.appendChild(stopSpeak);
        bubble.appendChild(actions);
        var selfMsg = this;
        listen.addEventListener("click", function () {
          var node = item.querySelector(".msg-text");
          selfMsg._activeMessage = item;
          selfMsg._speak(
            (node && node.textContent) || "",
            (node && node.lang) || selfMsg._lang,
          );
        });
        stopSpeak.addEventListener("click", function () {
          selfMsg._stopSpoken();
          selfMsg._status(selfMsg._text("voice.stopped"));
          listen.focus();
        });
      }
      this._log.insertBefore(item, this._log.querySelector(".typing"));
      this._fillMessage(item);
      if (meta.role === "assistant") item.scrollIntoView({ block: "nearest" });
      else this._scrollToEnd();
    }

    _fillMessage(item) {
      var meta = item._meta;
      var who = item.querySelector(".who");
      var whoName = who.querySelector(".who-name");
      var text = item.querySelector(".msg-text");
      var dir = directionOf(this._bundle);
      who.lang = this._lang;
      who.dir = dir;
      if (whoName) {
        whoName.lang = this._lang;
        whoName.dir = dir;
        whoName.textContent = this._text(
          meta.role === "user" ? "message.you" : "message.assistant",
        );
      }
      if (meta.kind === "miss" || meta.kind === "advice") {
        text.lang = this._lang;
        text.textContent = this._text(
          meta.kind === "advice" ? "errors.advice" : "errors.notFound",
        );
        item.lang = this._lang;
      } else {
        text.lang = meta.lang || this._lang;
        text.textContent = meta.text;
      }
      var offer = item.querySelector(".msg-talk");
      if (offer) {
        offer.lang = this._lang;
        offer.dir = dir;
        offer.textContent = this._text("escalate.talk");
      }
      var label = item.querySelector(".sources-label");
      if (label) {
        label.lang = this._lang;
        label.textContent = this._text("sources.label");
      }
      var excerpt = (text.textContent || "").replace(/\s+/g, " ").trim();
      if (excerpt.length > 80) excerpt = excerpt.slice(0, 79) + "…";
      this._labelSpeechButton(
        item.querySelector(".msg-listen"),
        "composer.listen",
        excerpt,
        text.lang,
      );
      this._labelSpeechButton(
        item.querySelector(".msg-stop"),
        "composer.stop",
        excerpt,
        text.lang,
      );
    }

    _labelSpeechButton(el, key, excerpt, lang) {
      if (!el) return;
      var label = el.querySelector(".btn-label");
      var clip = el.querySelector(".clip");
      if (label) {
        label.lang = this._lang;
        label.textContent = this._text(key);
      }
      if (clip) {
        clip.lang = lang || this._lang;
        clip.dir = "auto";
        clip.textContent = excerpt || "";
      }
    }

    _relabelMessages() {
      if (!this._log) return;
      var items = this._log.querySelectorAll(".msg");
      for (var i = 0; i < items.length; i += 1) this._fillMessage(items[i]);
    }

    _clearSaved() {
      this._stopPageWork(false);
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i += 1) {
          var key = localStorage.key(i);
          if (key && key.indexOf("db-assistant:") === 0) keys.push(key);
        }
        for (var j = 0; j < keys.length; j += 1)
          localStorage.removeItem(keys[j]);
      } catch (err) {
        /* Nothing stored, or storage is blocked. */
      }
      try {
        var sessionKeys = [];
        for (var s = 0; s < sessionStorage.length; s += 1) {
          var sessionKey = sessionStorage.key(s);
          if (sessionKey && sessionKey.indexOf("db-assistant:") === 0)
            sessionKeys.push(sessionKey);
        }
        for (var t = 0; t < sessionKeys.length; t += 1)
          sessionStorage.removeItem(sessionKeys[t]);
      } catch (err) {
        /* Nothing stored, or storage is blocked. */
      }
      this._speechOk = false;
      if (this._offerKind === "pick") this._hideOffer();
      this._pendingLang = "";
      this._translateAfterLoad = "";
      this._shareOn = false;
      this._stopShare(true);
      this._consent.hidden = true;
      this._commandsOn = false;
      this._commandsBlocked = false;
      this._stopDictation();
      this._stopCommands();
      this._stopSpoken();
      this._a11y = defaultA11y();
      applyHostEffects(this._a11y);
      this._syncHover();
      this._noteKey = "status.cleared";
      this._status(this._text("status.cleared"));
      this._load();
    }

    _buildSettings() {
      this._settings = document.createElement("div");
      this._settings.id = "db-settings";
      this._settings.className = "settings";
      this._settings.setAttribute("role", "region");
      this._settings.setAttribute("aria-labelledby", "db-settings-title");
      this._settingsTitle = document.createElement("h3");
      this._settingsTitle.id = "db-settings-title";
      this._settingsTitle.className = "clip";
      this._tablist = document.createElement("div");
      this._tablist.className = "tablist";
      this._tablist.setAttribute("role", "tablist");
      this._tablist.setAttribute("aria-orientation", "horizontal");
      this._tabs = [];
      this._filters = [];
      this._grouped = [];
      this._filterPanel = document.createElement("div");
      this._filterPanel.id = "db-a11y-options";
      this._filterPanel.className = "tabpanel";
      this._filterPanel.setAttribute("role", "tabpanel");
      this._makeFilterTab("db-tab-all", "all");
      this._makeFilterTab("db-tab-display", "display");
      this._makeFilterTab("db-tab-speech", "speech");

      /* One grid. The tabs only filter it: "all" shows every tile, other groups show matching ones. */
      var grid = document.createElement("div");
      grid.className = "a11y-grid";

      var text = this._makeStepCard("type", "db-text-size");
      this._textLabel = text.label;
      this._textValue = text.value;
      this._textSmaller = text.less;
      this._textBigger = text.more;
      var spacing = this._makeStepCard("spacing", "db-spacing");
      this._spacingLabel = spacing.label;
      this._spacingValue = spacing.value;
      this._spacingLess = spacing.less;
      this._spacingMore = spacing.more;

      this._contrastBtn = this._makeToggle("contrast");
      this._dyslexiaBtn = this._makeToggle("dyslexia");
      this._cursorBtn = this._makeToggle("cursor");
      this._linksBtn = this._makeToggle("link");
      this._hoverBtn = this._makeToggle("volume");
      this._hoverBtn.setAttribute("aria-describedby", "db-hover-help");
      this._commandsBtn = this._makeToggle("mic");
      this._commandsBtn.setAttribute("aria-describedby", "db-commands-help");
      this._readSelectedBtn = this._makeAction("select");
      this._stopReadBtn = this._makeAction("stop");
      this._shareToggle = this._makeToggle("screen");
      this._shareToggle.setAttribute("aria-describedby", "db-share-help");
      this._shareStart = this._makeAction("screen");
      this._shareStart.hidden = true;
      this._shareSend = this._makeAction("send");
      this._shareSend.hidden = true;
      this._shareSend.setAttribute("aria-describedby", "db-share-send-help");
      this._areaBtn = this._makeAction("pin");
      this._areaBtn.setAttribute("aria-describedby", "db-area-consent");
      this._clearBtn = this._makeAction("trash");

      this._infoButtons = [];
      this._descs = [];
      var tiles = [
        [
          this._commandsBtn,
          "settings.voiceCommands",
          ["info.voiceCommands", "settings.voiceHelp"],
          "desc.voiceCommands",
          "speech",
          true,
        ],
        [
          text.card,
          "settings.textSize",
          ["info.textSize"],
          "desc.textSize",
          "display",
        ],
        [
          this._contrastBtn,
          "settings.contrast",
          ["info.contrast"],
          "desc.contrast",
          "display",
        ],
        [
          this._dyslexiaBtn,
          "settings.dyslexia",
          ["info.dyslexia"],
          "desc.dyslexia",
          "display",
        ],
        [
          spacing.card,
          "settings.spacing",
          ["info.spacing"],
          "desc.spacing",
          "display",
        ],
        [
          this._cursorBtn,
          "settings.cursor",
          ["info.cursor"],
          "desc.cursor",
          "display",
        ],
        [
          this._linksBtn,
          "settings.highlightLinks",
          ["info.links"],
          "desc.links",
          "display",
        ],
        [
          this._hoverBtn,
          "settings.readHover",
          ["settings.readHoverHelp"],
          "desc.readHover",
          "speech",
        ],
        [
          this._readSelectedBtn,
          "settings.readSelected",
          ["info.readSelected"],
          "desc.readSelected",
          "speech",
        ],
        [
          this._stopReadBtn,
          "settings.stopReading",
          ["info.stopReading"],
          "desc.stopReading",
          "speech",
        ],
        [
          this._shareToggle,
          "screen.toggle",
          ["screen.help"],
          "desc.screenToggle",
          "display other",
        ],
        [
          this._shareStart,
          "screen.start",
          ["screen.help"],
          "desc.screenStart",
          "display other",
        ],
        [
          this._shareSend,
          "screen.sendPage",
          ["screen.sendHelp"],
          "desc.screenSend",
          "display other",
        ],
        [
          this._areaBtn,
          "area.button",
          ["info.area", "area.consent"],
          "desc.area",
          "display other",
        ],
        [
          this._clearBtn,
          "settings.clear",
          ["info.clear"],
          "desc.clear",
          "other",
        ],
      ];
      for (var t = 0; t < tiles.length; t += 1) {
        var spec = tiles[t];
        this._addDesc(spec[0], spec[3]);
        this._group(
          grid,
          this._tile(spec[0], spec[1], spec[2], spec[5]),
          spec[4],
        );
      }

      var notes = document.createElement("div");
      notes.className = "a11y-notes";
      this._speechReport = paragraph("help");
      this._hoverHelp = paragraph("help");
      this._hoverHelp.id = "db-hover-help";
      this._commandsHelp = paragraph("help");
      this._commandsHelp.id = "db-commands-help";
      this._commandsSavedNote = paragraph("help");
      this._commandsSavedNote.hidden = true;
      var commandBox = document.createElement("details");
      commandBox.className = "command-box";
      this._commandLabel = document.createElement("summary");
      this._commandLabel.id = "db-command-label";
      this._commandList = document.createElement("ul");
      this._commandList.className = "command-list";
      this._commandList.setAttribute("aria-labelledby", "db-command-label");
      commandBox.appendChild(this._commandLabel);
      commandBox.appendChild(this._commandList);
      this._shareHelp = paragraph("help");
      this._shareHelp.id = "db-share-help";
      this._shareUnsupported = paragraph("help");
      this._shareUnsupported.setAttribute("role", "status");
      this._shareSendHelp = paragraph("help");
      this._shareSendHelp.id = "db-share-send-help";
      this._shareSendHelp.hidden = true;
      this._areaConsent = paragraph("help");
      this._areaConsent.id = "db-area-consent";
      this._areaStatus = paragraph("help");
      this._areaStatus.setAttribute("role", "status");
      this._group(notes, this._commandsHelp, "speech");
      this._group(notes, this._commandsSavedNote, "speech");
      this._group(notes, commandBox, "speech");
      this._group(notes, this._hoverHelp, "speech");
      this._group(notes, this._speechReport, "speech");
      this._group(notes, this._shareHelp, "display other");
      this._group(notes, this._shareUnsupported, "display other");
      this._group(notes, this._shareSendHelp, "display other");
      this._group(notes, this._areaConsent, "display other");
      this._group(notes, this._areaStatus, "display other");

      this._resetHelp = paragraph("help");
      this._resetHelp.id = "db-reset-help";
      notes.appendChild(this._resetHelp);
      this._resetBtn = button("a11y-reset");
      this._resetBtn.setAttribute("aria-describedby", "db-reset-help");
      this._resetBtn.appendChild(icon("refresh"));
      var resetLabel = document.createElement("span");
      resetLabel.className = "btn-label";
      this._resetBtn.appendChild(resetLabel);

      this._filterPanel.appendChild(grid);
      this._filterPanel.appendChild(notes);
      this._settings.appendChild(this._settingsTitle);
      this._settings.appendChild(this._tablist);
      this._settings.appendChild(this._filterPanel);
      this._settings.appendChild(this._resetBtn);
      this._selectTab(0);
      this._buildInfo();
    }

    /* Wraps a card so its "more info" button sits beside it, not inside it (no nested buttons). */
    _tile(card, titleKey, bodyKeys, withCommands) {
      var tile = document.createElement("div");
      tile.className = "a11y-tile";
      var more = button("info-btn");
      more.setAttribute("aria-haspopup", "dialog");
      more.setAttribute("aria-expanded", "false");
      more.setAttribute("aria-controls", "db-info");
      more.appendChild(icon("more"));
      more._info = {
        title: titleKey,
        body: bodyKeys,
        commands: withCommands === true,
      };
      tile.appendChild(card);
      tile.appendChild(more);
      tile.hidden = card.hidden;
      new MutationObserver(function () {
        tile.hidden = card.hidden;
      }).observe(card, { attributes: true, attributeFilter: ["hidden"] });
      var self = this;
      more.addEventListener("click", function () {
        self._openInfo(more);
      });
      this._infoButtons.push(more);
      return tile;
    }

    _buildInfo() {
      this._info = document.createElement("dialog");
      this._info.id = "db-info";
      this._info.className = "info-pop";
      this._info.setAttribute("aria-labelledby", "db-info-title");
      var head = document.createElement("div");
      head.className = "info-head";
      this._infoTitle = document.createElement("h2");
      this._infoTitle.id = "db-info-title";
      this._infoClose = button("icon-btn close");
      this._infoClose.appendChild(icon("close"));
      head.appendChild(this._infoTitle);
      head.appendChild(this._infoClose);
      this._infoBody = document.createElement("div");
      this._infoBody.className = "info-body";
      this._info.appendChild(head);
      this._info.appendChild(this._infoBody);
      this._infoTrigger = null;
      var self = this;
      this._infoClose.addEventListener("click", function () {
        self._info.close();
      });
      this._info.addEventListener("cancel", function (event) {
        event.preventDefault();
        self._info.close();
      });
      this._info.addEventListener("close", function () {
        var back = self._infoTrigger;
        self._infoTrigger = null;
        if (!back) return;
        back.setAttribute("aria-expanded", "false");
        if (back.isConnected && self._a11yDialog && self._a11yDialog.open)
          back.focus();
      });
    }

    _openInfo(trigger) {
      if (!this._info || !trigger._info) return;
      if (this._infoTrigger && this._infoTrigger !== trigger)
        this._infoTrigger.setAttribute("aria-expanded", "false");
      this._infoTrigger = trigger;
      this._paintInfo();
      try {
        if (!this._info.open) this._info.showModal();
      } catch (err) {
        this._infoTrigger = null;
        return;
      }
      trigger.setAttribute("aria-expanded", "true");
      this._infoClose.focus();
    }

    _paintInfo() {
      var spec = this._infoTrigger && this._infoTrigger._info;
      if (!spec) return;
      this._info.lang = this._lang;
      this._info.dir = directionOf(this._bundle);
      this._infoTitle.textContent = this._text(spec.title);
      this._labelIcon(this._infoClose, this._text("panel.close"));
      this._infoBody.replaceChildren();
      for (var i = 0; i < spec.body.length; i += 1) {
        var p = paragraph();
        p.textContent = this._text(spec.body[i]);
        this._infoBody.appendChild(p);
      }
      if (!spec.commands) return;
      var heading = document.createElement("h3");
      heading.id = "db-info-commands";
      heading.textContent = this._text("settings.commandList");
      var list = document.createElement("ul");
      list.className = "command-list";
      list.setAttribute("aria-labelledby", "db-info-commands");
      this._fillCommandList(list);
      this._infoBody.appendChild(heading);
      this._infoBody.appendChild(list);
    }

    _labelInfoButtons() {
      if (!this._infoButtons) return;
      for (var i = 0; i < this._infoButtons.length; i += 1) {
        var more = this._infoButtons[i];
        this._labelIcon(
          more,
          fill(this._text("info.label"), {
            name: this._text(more._info.title),
          }),
        );
      }
      if (this._info && this._info.open) this._paintInfo();
    }

    _setCardBusy(card, on) {
      if (!card) return;
      if (!card._busyEl) {
        var veil = document.createElement("span");
        veil.className = "card-busy";
        veil.setAttribute("aria-hidden", "true");
        veil.appendChild(spinnerIcon());
        card.appendChild(veil);
        card._busyEl = veil;
      }
      window.clearTimeout(card._busyTimer);
      card.classList.toggle("is-busy", on === true);
      if (on) card.setAttribute("aria-busy", "true");
      else card.removeAttribute("aria-busy");
    }

    _flashBusy(card) {
      var self = this;
      this._setCardBusy(card, true);
      card._busyTimer = window.setTimeout(function () {
        self._setCardBusy(card, false);
      }, 450);
    }

    _group(parent, el, name) {
      el.setAttribute("data-group", name);
      parent.appendChild(el);
      this._grouped.push(el);
    }

    _makeFilterTab(tabId, filter) {
      var tab = button("tab");
      tab.id = tabId;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "db-a11y-options");
      tab.setAttribute("aria-selected", "false");
      tab.tabIndex = -1;
      var self = this;
      tab.addEventListener("click", function () {
        self._selectTab(self._tabs.indexOf(tab));
        tab.focus();
      });
      this._tablist.appendChild(tab);
      this._tabs.push(tab);
      this._filters.push(filter);
    }

    _makeStepCard(iconName, idBase) {
      var card = document.createElement("div");
      card.className = "a11y-card a11y-text";
      card.appendChild(icon(iconName));
      var label = document.createElement("span");
      label.className = "a11y-label";
      label.id = idBase + "-label";
      var value = document.createElement("span");
      value.className = "a11y-value";
      value.id = idBase + "-value";
      value.setAttribute("role", "status");
      var stepper = document.createElement("div");
      stepper.className = "stepper";
      stepper.setAttribute("role", "group");
      stepper.setAttribute("aria-labelledby", label.id);
      var less = this._makeStep("\u2212");
      var more = this._makeStep("+");
      stepper.appendChild(less);
      stepper.appendChild(more);
      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(stepper);
      return { card: card, label: label, value: value, less: less, more: more };
    }

    /* The short line under a card's name. The info dialog holds the full text, so screen readers skip this copy. */
    _addDesc(card, key) {
      var desc = document.createElement("span");
      desc.className = "a11y-desc";
      desc.setAttribute("aria-hidden", "true");
      var label = card.querySelector(".a11y-label");
      if (label && label.nextSibling)
        card.insertBefore(desc, label.nextSibling);
      else card.appendChild(desc);
      this._descs.push({ el: desc, key: key });
    }

    _paintDescs() {
      if (!this._descs) return;
      for (var i = 0; i < this._descs.length; i += 1) {
        this._descs[i].el.lang = this._lang;
        this._descs[i].el.textContent = this._text(this._descs[i].key);
      }
    }

    _makeStep(glyph) {
      var el = button("text-btn step");
      var face = document.createElement("span");
      face.setAttribute("aria-hidden", "true");
      face.textContent = glyph;
      var name = document.createElement("span");
      name.className = "clip";
      el.appendChild(face);
      el.appendChild(name);
      el._face = { name: name };
      return el;
    }

    _makeAction(name) {
      var el = button("a11y-card action");
      el.appendChild(icon(name));
      var label = document.createElement("span");
      label.className = "a11y-label";
      el.appendChild(label);
      el._face = { label: label };
      return el;
    }

    _labelAction(el, text) {
      if (el && el._face && el._face.label) el._face.label.textContent = text;
      else if (el) el.textContent = text;
    }

    _makeToggle(name) {
      var el = button("a11y-card toggle");
      el.setAttribute("role", "switch");
      el.setAttribute("aria-checked", "false");
      el.appendChild(icon(name));
      var label = document.createElement("span");
      label.className = "a11y-label";
      label.setAttribute("aria-hidden", "true");
      var value = document.createElement("span");
      value.className = "a11y-value";
      value.setAttribute("aria-hidden", "true");
      var accessible = document.createElement("span");
      accessible.className = "clip";
      el.appendChild(label);
      el.appendChild(value);
      el.appendChild(accessible);
      var track = document.createElement("span");
      track.className = "switch-ui";
      track.setAttribute("aria-hidden", "true");
      el.appendChild(track);
      el._face = { label: label, value: value, name: accessible };
      return el;
    }

    _paintSwitch(el, label, value, on, nameText) {
      if (!el) return;
      el.setAttribute("aria-checked", on ? "true" : "false");
      el.removeAttribute("aria-pressed");
      if (el._face) {
        el._face.label.textContent = label;
        el._face.value.textContent = value;
        el._face.name.textContent = nameText;
        return;
      }
      el.textContent = nameText;
    }

    _selectTab(index) {
      if (!this._tabs || !this._tabs.length) return;
      if (index < 0) index = this._tabs.length - 1;
      if (index >= this._tabs.length) index = 0;
      this._tabIndex = index;
      for (var i = 0; i < this._tabs.length; i += 1) {
        var on = i === index;
        this._tabs[i].setAttribute("aria-selected", on ? "true" : "false");
        this._tabs[i].tabIndex = on ? 0 : -1;
      }
      this._filterPanel.setAttribute("aria-labelledby", this._tabs[index].id);
      var filter = this._filters[index];
      for (var j = 0; j < this._grouped.length; j += 1) {
        var groups = this._grouped[j].getAttribute("data-group").split(" ");
        this._grouped[j].classList.toggle(
          "is-filtered",
          filter !== "all" && groups.indexOf(filter) === -1,
        );
      }
    }

    _filterIndex(name) {
      var index = this._filters ? this._filters.indexOf(name) : -1;
      return index < 0 ? 0 : index;
    }

    _onTabKey(event) {
      var key = event.key;
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].indexOf(key) === -1
      )
        return;
      var index = this._tabs.indexOf(this._root.activeElement);
      if (index < 0) return;
      event.preventDefault();
      var dir = directionOf(this._bundle);
      var next = index;
      if (key === "Home") next = 0;
      else if (key === "End") next = this._tabs.length - 1;
      else {
        var delta = 0;
        if (key === "ArrowDown") delta = 1;
        else if (key === "ArrowUp") delta = -1;
        else if (key === "ArrowRight") delta = dir === "rtl" ? -1 : 1;
        else if (key === "ArrowLeft") delta = dir === "rtl" ? 1 : -1;
        next = (index + delta + this._tabs.length) % this._tabs.length;
      }
      this._selectTab(next);
      this._tabs[next].focus();
    }

    _toggleText(labelKey, on) {
      return (
        this._text(labelKey) +
        ": " +
        this._text(on ? "settings.on" : "settings.off")
      );
    }

    _renderA11y() {
      if (!this._contrastBtn || !this._a11y) return;
      var pairs = [
        [this._contrastBtn, "settings.contrast", this._a11y.contrast],
        [this._dyslexiaBtn, "settings.dyslexia", this._a11y.dyslexia],
        [this._hoverBtn, "settings.readHover", this._a11y.hover],
        [this._linksBtn, "settings.highlightLinks", this._a11y.links],
      ];
      for (var i = 0; i < pairs.length; i += 1) {
        var on = pairs[i][2] === true;
        this._paintSwitch(
          pairs[i][0],
          this._text(pairs[i][1]),
          this._text(on ? "settings.on" : "settings.off"),
          on,
          this._toggleText(pairs[i][1], on),
        );
      }
      var big = this._a11y.cursor === true;
      var cursorValue = this._text(
        big ? "settings.cursorLarge" : "settings.cursorNormal",
      );
      this._paintSwitch(
        this._cursorBtn,
        this._text("settings.cursor"),
        cursorValue,
        big,
        this._text("settings.cursor") + ": " + cursorValue,
      );
      this._textValue.textContent = fill(this._text("settings.textValue"), {
        size: String(this._a11y.textSize),
      });
      this._spacingValue.textContent = fill(this._text("settings.textValue"), {
        size: String(this._a11y.spacing),
      });
    }

    _setA11y(patch) {
      var next = defaultA11y();
      var key;
      for (key in this._a11y) {
        if (Object.prototype.hasOwnProperty.call(this._a11y, key))
          next[key] = this._a11y[key];
      }
      for (key in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, key))
          next[key] = patch[key];
      }
      var size = Math.round(Number(next.textSize) / 10) * 10;
      next.textSize = Math.min(200, Math.max(100, size || 100));
      var spacing = Math.round(Number(next.spacing) / 20) * 20;
      next.spacing = Math.min(200, Math.max(100, spacing || 100));
      this._a11y = next;
      applyHostEffects(next);
      saveA11y(next);
      this._syncHover();
      this._renderA11y();
    }

    _flipA11y(key, labelKey) {
      var on = !this._a11y[key];
      var patch = {};
      patch[key] = on;
      this._setA11y(patch);
      this._status(this._toggleText(labelKey, on));
    }

    _stepText(delta, transcript) {
      var doneKey = delta > 0 ? "voice.textBigger" : "voice.textSmaller";
      this._stepSetting(
        "textSize",
        delta,
        transcript,
        doneKey,
        "voice.textMax",
        "voice.textMin",
      );
    }

    _stepSpacing(delta, transcript) {
      this._stepSetting(
        "spacing",
        delta,
        transcript,
        "voice.spacing",
        "voice.spacingMax",
        "voice.spacingMin",
      );
    }

    _stepSetting(key, delta, transcript, doneKey, maxKey, minKey) {
      var current = this._a11y[key];
      if (delta > 0 && current >= 200) {
        this._say(maxKey, transcript);
        return;
      }
      if (delta < 0 && current <= 100) {
        this._say(minKey, transcript);
        return;
      }
      var patch = {};
      patch[key] = current + delta;
      this._setA11y(patch);
      this._say(doneKey, transcript, { size: String(this._a11y[key]) });
    }

    /* A voice command repeats what was heard before the result. A click shows only the result. */
    _say(key, transcript, map) {
      if (transcript) this._announce(key, transcript, map);
      else this._status(fill(this._text(key), map || {}));
    }

    _syncHover(forceOff) {
      var want = forceOff !== true && this._a11y && this._a11y.hover === true;
      if (want && !this._hoverListening) {
        var self = this;
        this._onHover = function (event) {
          self._hoverMove(event);
        };
        document.addEventListener("pointerover", this._onHover);
        this._hoverListening = true;
      } else if (!want && this._hoverListening && this._onHover) {
        document.removeEventListener("pointerover", this._onHover);
        this._hoverListening = false;
        this._hoverBlock = null;
        window.clearTimeout(this._hoverTimer);
      }
    }

    _hoverMove(event) {
      if (!this._a11y || !this._a11y.hover || this._dictating || this._speechOn)
        return;
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("db-assistant")) return;
      var block = target.closest(
        "p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dd",
      );
      if (!block || block === this._hoverBlock) return;
      this._hoverBlock = block;
      var text = clean(block.textContent || "");
      if (text.length < 2) return;
      var self = this;
      var lang = this._langOf(block, text);
      window.clearTimeout(this._hoverTimer);
      this._hoverTimer = window.setTimeout(function () {
        if (self._hoverBlock !== block || !self._a11y.hover) return;
        self._speak(text.slice(0, 2500), lang, { exact: true });
      }, 450);
    }

    /** Page text is read in its own language: the nearest lang attribute, corrected by script. */
    _langOf(node, text) {
      var el = node && node.nodeType === 1 ? node : node && node.parentElement;
      var holder = el && el.closest ? el.closest("[lang]") : null;
      var tagged = holder
        ? String(holder.getAttribute("lang") || "")
            .toLowerCase()
            .split("-")[0]
        : "";
      if (holder && holder.localName === "db-assistant") tagged = this._lang;
      if (!/^[a-z]{2,3}$/.test(tagged)) tagged = "";
      return scriptOf(text, tagged || this._lang);
    }

    _renderCommands() {
      if (!this._commandsBtn) return;
      var on = this._commandsOn === true;
      var commandLabel = this._text("settings.voiceCommands");
      if (on)
        this._paintSwitch(
          this._commandsBtn,
          commandLabel,
          this._text("voice.listening"),
          true,
          this._text("voice.listening"),
        );
      else
        this._paintSwitch(
          this._commandsBtn,
          commandLabel,
          this._text("settings.off"),
          false,
          this._toggleText("settings.voiceCommands", false),
        );
      var showSaved = commandsSaved() && !on;
      this._commandsSavedNote.hidden = !showSaved;
      this._commandsSavedNote.textContent = showSaved
        ? this._text("settings.commandsSaved")
        : "";
    }

    _renderCommandList() {
      if (!this._commandList) return;
      this._fillCommandList(this._commandList);
    }

    _fillCommandList(target) {
      target.replaceChildren();
      var current = (this._bundle && this._bundle.commands) || {};
      var english = englishPack.commands || {};
      var ids = Object.keys(current);
      for (var i = 0; i < ids.length; i += 1) {
        var phrases = current[ids[i]];
        if (!phrases || !phrases.length) continue;
        var li = document.createElement("li");
        var own = document.createElement("span");
        own.lang = this._lang;
        own.textContent = phrases[0];
        li.appendChild(own);
        if (
          this._lang !== "en" &&
          english[ids[i]] &&
          english[ids[i]][0] &&
          english[ids[i]][0] !== phrases[0]
        ) {
          li.appendChild(document.createTextNode(" / "));
          var en = document.createElement("span");
          en.lang = "en";
          en.textContent = english[ids[i]][0];
          li.appendChild(en);
        }
        target.appendChild(li);
      }
    }

    _commandLines() {
      var commands = (this._bundle && this._bundle.commands) || {};
      var ids = Object.keys(commands);
      var lines = [];
      for (var i = 0; i < ids.length; i += 1) {
        if (commands[ids[i]] && commands[ids[i]][0])
          lines.push(commands[ids[i]][0]);
      }
      return lines;
    }

    _cloudLine() {
      if (!this._api) return this._text("speech.cloudNoApi");
      if (!this._tts || !this._tts.checked)
        return this._text("speech.cloudUnknown");
      var addis =
        this._lang === "am" ||
        this._lang === "om" ||
        this._lang === "ti" ||
        this._lang === "so";
      if (addis)
        return this._text(
          this._tts.addis ? "speech.cloudAddisOn" : "speech.cloudAddisOff",
        );
      return this._text(
        this._tts.gemini ? "speech.cloudGeminiOn" : "speech.cloudGeminiOff",
      );
    }

    _renderSpeechReport() {
      if (!this._speechReport) return;
      var rec = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      this._speechReport.textContent = [
        this._text(rec ? "speech.recogYes" : "speech.recogNo"),
        this._voiceReport || this._text("speech.voiceWait"),
        this._cloudLine(),
        this._text("speech.cloudSends"),
      ].join(" ");
    }

    _primeVoices() {
      var self = this;
      if (!this._voiceWatch && window.speechSynthesis) {
        this._voiceWatch = function () {
          self._reportVoices();
        };
        window.speechSynthesis.addEventListener(
          "voiceschanged",
          this._voiceWatch,
        );
      }
      this._reportVoices();
    }

    _reportVoices() {
      var lang = this._lang;
      var self = this;
      loadProvider("speech-browser")
        .then(function (mod) {
          self._browserSpeech = mod;
          var voices = window.speechSynthesis
            ? window.speechSynthesis.getVoices() || []
            : [];
          if (lang !== self._lang) return;
          if (!voices.length)
            self._voiceReport = self._text("speech.voiceWait");
          else {
            var matches = mod.matchingVoices(lang, voices);
            self._voiceReport = self._text(
              matches.length ? "speech.voiceYes" : "speech.voiceNo",
            );
          }
          self._renderSpeechReport();
        })
        .catch(function () {
          self._voiceReport = self._text("speech.voiceNo");
          self._renderSpeechReport();
        });
    }

    /**
     * Health is read again on every Listen. A result from page load is not reused.
     * data-api is rooted at the origin (or used as an absolute URL), never the page folder.
     */
    _readTts() {
      var self = this;
      if (!this._api) {
        this._tts = { addis: false, gemini: false, checked: true };
        return Promise.resolve(this._tts);
      }
      return loadApiUrl()
        .then(function (mod) {
          var url = mod.apiUrl(self._api, "/v1/health", location.origin);
          return fetch(url, {
            headers: { accept: "application/json" },
            cache: "no-store",
            mode: "cors",
            credentials: "omit",
          }).then(function (response) {
            if (!response.ok) {
              var error = new Error("");
              error.status = response.status;
              error.path = url;
              throw error;
            }
            return response.json();
          });
        })
        .then(function (body) {
          self._rememberHealth(body);
          if (self._telegramLink) self._syncTelegram();
          self._tts = {
            addis: body && body.ttsAddis === true,
            gemini: body && body.ttsGemini === true,
            checked: true,
          };
          self._renderSpeechReport();
          return self._tts;
        });
    }

    _ensureTts() {
      var self = this;
      return this._readTts().catch(function () {
        self._tts = { addis: false, gemini: false, checked: false };
        self._renderSpeechReport();
        return self._tts;
      });
    }

    _languageMeta(code) {
      var list = this._languages || [];
      var want = String(code || "")
        .toLowerCase()
        .split("-")[0];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].code === want) return list[i];
      }
      return null;
    }

    _addisLang(code) {
      var item = this._languageMeta(code);
      return !!(item && item.addis && item.addis !== "none");
    }

    _speechTag(code) {
      var item = this._languageMeta(code || this._lang);
      return (item && item.speech) || "en-US";
    }

    /** Addis languages follow the reply, or the selected language when the lesson text is tagged en. */
    _speechLang(textLang) {
      var text = String(textLang || "")
        .toLowerCase()
        .split("-")[0];
      var ui = String(this._lang || "")
        .toLowerCase()
        .split("-")[0];
      if (this._addisLang(text)) return text;
      if (this._addisLang(ui)) return ui;
      return text || ui || "en";
    }

    /** Start playback in this click, before health and the audio file are fetched. */
    _primeSpeech() {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (Context && !this._speechContext) {
        try {
          this._speechContext = new Context();
        } catch (err) {
          this._speechContext = null;
        }
      }
      if (this._speechContext && this._speechContext.state === "suspended") {
        this._speechContext.resume().catch(function () {});
      }
      if (!this._speechAudio) this._speechAudio = new Audio();
      this._speechAudio.setAttribute("playsinline", "");
      if (!this._speechAudio.getAttribute("data-primed")) {
        this._speechAudio.src = SILENT_WAV;
        this._speechAudio.setAttribute("data-primed", "1");
      }
      var pending = this._speechAudio.play();
      if (pending && pending.catch) pending.catch(function () {});
    }

    _faultText(error) {
      var status = error && error.status ? String(error.status) : "";
      var path = error && error.path ? String(error.path) : "";
      var message = error && error.message ? String(error.message) : "";
      var parts = [];
      if (status) parts.push(status);
      if (path) parts.push(path);
      if (
        message &&
        message !== path &&
        parts.join(" ").indexOf(message) === -1
      )
        parts.push(message);
      var text = parts.join(" ").trim();
      return text || this._text("speech.failed");
    }

    _status(text) {
      this._statusText = text || "";
      this._paintStatus();
    }

    _paintStatus() {
      var text = this._statusText || "";
      var open = !!(this._dialog && this._dialog.open);
      var listening = !open && this._commandsOn === true;
      var outside = text;
      if (listening) {
        var hear = this._text("voice.listening");
        outside = text && text !== hear ? hear + " " + text : hear;
      }
      if (this._speechLine) this._speechLine.textContent = open ? text : "";
      if (this._voiceLive) {
        var show = !open && !!outside;
        this._voiceLive.textContent = show ? outside : "";
        this._voiceLive.classList.toggle("is-shown", show);
      }
    }

    _announce(actionKey, transcript, map) {
      var action = fill(this._text(actionKey), map || {});
      this._status(
        fill(this._text("voice.line"), {
          phrase: clean(transcript),
          action: action,
        }),
      );
    }

    _matcher() {
      if (!this._matchPromise) {
        this._matchPromise = import(new URL("voice-match.js", scriptUrl));
      }
      return this._matchPromise;
    }

    _haltAudio() {
      if (this._cloudSpeech) this._cloudSpeech.stop();
      if (this._browserSpeech && this._browserSpeech.stop)
        this._browserSpeech.stop();
    }

    _markListenPressed() {
      if (!this._log) return;
      var buttons = this._log.querySelectorAll(".msg-listen");
      for (var i = 0; i < buttons.length; i += 1) {
        var item = buttons[i].closest(".msg");
        var on = this._speechOn && item === this._activeMessage;
        buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }

    _speak(text, lang, options) {
      var cleaned = clean(text);
      var opts = options || {};
      var restore = opts.restore || "";
      var self = this;
      if (!cleaned) {
        this._status(this._text("speech.unavailable"));
        return Promise.resolve();
      }
      var token = ++this._speechToken;
      this._speechOn = true;
      this._dictating = false;
      this._haltAudio();
      this._primeSpeech();
      this._speechToken = token;
      if (this._recogMode === "commands" || this._recogMode === "dictation")
        this._abortRecognition();
      this._renderMic();
      this._status(this._text("speech.loading"));
      this._markListenPressed();
      var speakLang = opts.exact
        ? String(lang || this._lang)
            .toLowerCase()
            .split("-")[0]
        : this._speechLang(lang || this._lang);
      return this._readTts()
        .catch(function () {
          var reachable = !!self._api;
          self._tts = { addis: reachable, gemini: reachable, checked: false };
          return self._tts;
        })
        .then(function () {
          return self._matcher();
        })
        .then(function (mod) {
          var parts = mod.chunkText(cleaned, 2400);
          var chain = Promise.resolve({ code: "ok" });
          parts.forEach(function (part) {
            chain = chain.then(function (prev) {
              if (!prev || prev.code !== "ok" || token !== self._speechToken)
                return prev;
              return self._speakPart(part, speakLang, token);
            });
          });
          return chain;
        })
        .then(function (result) {
          if (token !== self._speechToken) return;
          self._speechOn = false;
          self._activeMessage = null;
          self._markListenPressed();
          self._finishSpeech(result, restore);
          self._resumeCommands();
        })
        .catch(function (error) {
          if (token !== self._speechToken) return;
          self._speechOn = false;
          self._activeMessage = null;
          self._markListenPressed();
          self._status(self._faultText(error));
          self._resumeCommands();
        });
    }

    _finishSpeech(result, restore) {
      var code = result && result.code;
      if (code === "no-voice") this._status(this._text("speech.unavailable"));
      else if (code === "cloud" || code === "fail")
        this._status(result.message || this._text("speech.failed"));
      else if (restore) this._status(restore);
      else this._status("");
    }

    _speakPart(text, lang, token) {
      var self = this;
      var addisLang = this._addisLang(lang);
      var wantCloud = addisLang
        ? this._tts.addis === true
        : this._tts.gemini === true;
      var cloudTry = Promise.resolve({ code: "skip" });
      if (wantCloud && this._api) {
        cloudTry = loadProvider("speech-cloud")
          .then(function (mod) {
            self._cloudSpeech = mod;
            if (token !== self._speechToken) return { code: "aborted" };
            mod.prepare(self._api);
            self._status(self._text("speech.loading"));
            return mod
              .speak(text, lang, {
                audio: self._speechAudio,
                context: self._speechContext,
                playing: function () {
                  if (token === self._speechToken)
                    self._status(self._text("speech.speaking"));
                },
              })
              .then(function (played) {
                return { code: played === "aborted" ? "aborted" : "ok" };
              });
          })
          .catch(function (error) {
            return { code: "cloud", message: self._faultText(error) };
          });
      }
      return cloudTry.then(function (cloud) {
        if (token !== self._speechToken) return { code: "aborted" };
        if (cloud.code === "ok" || cloud.code === "aborted") return cloud;
        return self._browserSpeak(text, lang, token).then(function (browser) {
          if (browser.code === "ok" || browser.code === "aborted")
            return browser;
          if (cloud.code === "cloud") return cloud;
          return browser;
        });
      });
    }

    _browserSpeak(text, lang, token) {
      var self = this;
      return loadProvider("speech-browser")
        .then(function (mod) {
          self._browserSpeech = mod;
          return mod.loadVoices().then(function (voices) {
            if (token !== self._speechToken) return { code: "aborted" };
            if (!mod.matchingVoices(lang, voices).length)
              return { code: "no-voice" };
            self._status(self._text("speech.speaking"));
            return mod
              .speak(text, lang, self._speechTag(lang))
              .then(function (played) {
                return { code: played === "aborted" ? "aborted" : "ok" };
              });
          });
        })
        .catch(function (error) {
          if (
            error &&
            (error.code === "no-voice" || error.code === "unsupported")
          )
            return { code: "no-voice" };
          return { code: "fail", message: self._faultText(error) };
        });
    }

    _stopSpoken() {
      this._speechToken += 1;
      this._speechOn = false;
      this._haltAudio();
      this._activeMessage = null;
      this._markListenPressed();
      this._resumeCommands();
    }

    _resumeCommands() {
      if (
        !this._commandsOn ||
        this._commandsBlocked ||
        this._dictating ||
        this._speechOn
      )
        return;
      if (this._commandsListening) return;
      this._beginCommandLoop();
    }

    _renderMic() {
      if (!this._listenBtn) return;
      var on = this._dictating === true;
      this._listenBtn.setAttribute("aria-pressed", on ? "true" : "false");
      this._labelIcon(
        this._listenBtn,
        this._text(on ? "composer.listening" : "composer.mic"),
      );
      if (this._micState && this._micKey)
        this._micState.textContent = this._text(this._micKey);
    }

    _setMicMessage(key) {
      this._micKey = key || "";
      if (this._micState)
        this._micState.textContent = key ? this._text(key) : "";
    }

    _toggleMic() {
      if (this._dictating) {
        this._stopDictation();
        this._setMicMessage("composer.micOff");
        this._listenBtn.focus();
        return;
      }
      var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Speech) {
        this._showAlert("errors.speechUnsupported");
        this._setMicMessage("errors.speechUnsupported");
        return;
      }
      if (!this._speechOk) {
        this._consentPurpose = "dictation";
        this._consent.hidden = false;
        this._agreeBtn.focus();
        return;
      }
      this._startDictation();
    }

    _startDictation() {
      var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Speech) {
        this._showAlert("errors.speechUnsupported");
        this._setMicMessage("errors.speechUnsupported");
        return;
      }
      this._abortRecognition();
      this._dictating = true;
      this._recogMode = "dictation";
      var rec = new Speech();
      rec.lang = this._speechTag();
      rec.interimResults = true;
      rec.continuous = false;
      var self = this;
      var heard = "";
      rec.onstart = function () {
        self._dictating = true;
        self._setMicMessage("composer.listening");
        self._renderMic();
      };
      rec.onresult = function (event) {
        var text = "";
        for (var i = 0; i < event.results.length; i += 1) {
          text += (event.results[i][0] && event.results[i][0].transcript) || "";
        }
        heard = text;
        self._input.value = text;
        self._fitInput();
      };
      rec.onerror = function (event) {
        var code = event && event.error;
        if (code === "no-speech" || code === "aborted") return;
        if (code === "not-allowed" || code === "service-not-allowed") {
          self._showAlert("errors.micDenied");
          self._setMicMessage("errors.micDenied");
          return;
        }
        if (code === "network") {
          self._showAlert("errors.micNetwork");
          self._setMicMessage("errors.micNetwork");
          return;
        }
        if (code === "audio-capture") {
          self._showAlert("errors.micMissing");
          self._setMicMessage("errors.micMissing");
          return;
        }
        self._showAlert("errors.speechFailed");
        self._setMicMessage("errors.speechFailed");
      };
      rec.onend = function () {
        if (self._recognition === rec) self._recognition = null;
        self._dictating = false;
        if (self._recogMode === "dictation") self._recogMode = "";
        if (clean(heard)) {
          self._input.value = heard;
          self._fitInput();
          self._setMicMessage("composer.correct");
          self._input.focus();
        } else if (!self._micKey || self._micKey === "composer.listening") {
          self._setMicMessage("composer.micOff");
        }
        self._renderMic();
        if (self._commandsOn && !self._commandsBlocked && !self._speechOn)
          self._beginCommandLoop();
      };
      this._recognition = rec;
      try {
        rec.start();
        this._setMicMessage("composer.listening");
        this._renderMic();
      } catch (err) {
        this._dictating = false;
        this._recogMode = "";
        this._showAlert("errors.speechFailed");
        this._setMicMessage("errors.speechFailed");
        this._renderMic();
      }
    }

    _stopDictation() {
      var was = this._dictating || this._recogMode === "dictation";
      this._dictating = false;
      if (this._recogMode === "dictation") this._abortRecognition();
      this._renderMic();
      if (was && this._commandsOn && !this._commandsBlocked && !this._speechOn)
        this._beginCommandLoop();
    }

    _abortRecognition() {
      window.clearTimeout(this._commandTimer);
      var rec = this._recognition;
      this._recognition = null;
      this._recogMode = "";
      this._commandsListening = false;
      if (!rec) return;
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch (err) {
        /* Already stopped. */
      }
    }

    _toggleCommands() {
      if (this._commandsOn) {
        saveCommands(false);
        this._stopCommands();
        this._status(this._text("voice.commandsOff"));
        return;
      }
      var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Speech) {
        this._showAlert("errors.speechUnsupported");
        this._status(this._text("errors.speechUnsupported"));
        this._renderCommands();
        return;
      }
      if (!this._speechOk) {
        this._consentPurpose = "commands";
        this._consent.hidden = false;
        this._agreeBtn.focus();
        return;
      }
      saveCommands(true);
      this._commandsBlocked = false;
      this._networkFails = 0;
      this._commandsOn = true;
      this._commandLang = this._lang;
      this._renderCommands();
      this._beginCommandLoop();
    }

    _stopCommands() {
      this._commandsOn = false;
      this._commandsListening = false;
      if (this._recogMode === "commands") this._abortRecognition();
      this._renderCommands();
    }

    _beginCommandLoop() {
      var self = this;
      window.clearTimeout(this._commandTimer);
      if (
        !this._commandsOn ||
        this._commandsBlocked ||
        this._dictating ||
        this._speechOn
      )
        return;
      var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Speech) {
        this._commandsOn = false;
        this._status(this._text("errors.speechUnsupported"));
        this._renderCommands();
        return;
      }
      this._abortRecognition();
      var rec = new Speech();
      rec.lang = this._speechTag();
      rec.interimResults = false;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onstart = function () {
        self._commandsListening = true;
        self._networkFails = 0;
        self._startFails = 0;
        self._renderCommands();
        self._paintStatus();
        if (!self._statusText) self._status(self._text("voice.listening"));
      };
      rec.onresult = function (event) {
        var said = "";
        var start = event.resultIndex || 0;
        for (var i = start; i < event.results.length; i += 1) {
          if (event.results[i].isFinal)
            said =
              (event.results[i][0] && event.results[i][0].transcript) || "";
        }
        if (clean(said)) self._handleCommand(said);
      };
      rec.onerror = function (event) {
        var code = event && event.error;
        if (code === "no-speech" || code === "aborted") return;
        if (code === "not-allowed" || code === "service-not-allowed") {
          self._commandsBlocked = true;
          self._commandsOn = false;
          self._commandsListening = false;
          self._renderCommands();
          self._status(self._text("errors.micDenied"));
          return;
        }
        if (code === "audio-capture") {
          self._commandsBlocked = true;
          self._commandsOn = false;
          self._commandsListening = false;
          self._renderCommands();
          self._status(self._text("errors.micMissing"));
          return;
        }
        if (code === "network") {
          self._networkFails += 1;
          self._status(self._text("errors.micNetwork"));
          if (self._networkFails >= 3) {
            self._commandsBlocked = true;
            self._commandsOn = false;
            self._renderCommands();
          }
        }
      };
      rec.onend = function () {
        if (self._recognition === rec) self._recognition = null;
        self._commandsListening = false;
        if (self._recogMode === "commands") self._recogMode = "";
        self._renderCommands();
        if (
          !self._commandsOn ||
          self._commandsBlocked ||
          self._dictating ||
          self._speechOn
        )
          return;
        self._commandTimer = window.setTimeout(function () {
          self._beginCommandLoop();
        }, 300);
      };
      this._recognition = rec;
      this._recogMode = "commands";
      this._commandLang = this._lang;
      try {
        rec.start();
      } catch (err) {
        this._recognition = null;
        this._recogMode = "";
        this._startFails = (this._startFails || 0) + 1;
        if (this._startFails > 4) {
          this._commandsOn = false;
          this._renderCommands();
          this._status(this._text("errors.speechFailed"));
          return;
        }
        this._commandTimer = window.setTimeout(function () {
          self._beginCommandLoop();
        }, 400);
      }
    }

    _handleCommand(transcript) {
      var self = this;
      var said = clean(transcript);
      if (!said) return;
      this._matcher()
        .then(function (mod) {
          var sets = [];
          if (self._bundle && self._bundle.commands)
            sets.push(self._bundle.commands);
          if (englishPack.commands) sets.push(englishPack.commands);
          var hit = mod.matchCommand(said, sets);
          if (!hit) {
            self._status(fill(self._text("voice.unknown"), { phrase: said }));
            return;
          }
          self._runCommand(hit, said, mod);
        })
        .catch(function () {
          self._status(self._text("errors.generic"));
        });
    }

    _runCommand(hit, transcript, mod) {
      var id = hit.id;
      var flip = VOICE_SWITCHES[id];
      if (flip) {
        var patch = {};
        patch[flip[0]] = flip[1];
        this._setA11y(patch);
        this._announce(flip[2], transcript);
        return;
      }
      if (id === "open") {
        this._openPanel();
        this._announce("voice.opened", transcript);
        return;
      }
      if (id === "close") {
        var chatOpen = this._dialog && this._dialog.open;
        if (!chatOpen && this._a11yDialog && this._a11yDialog.open) {
          this._announce("voice.a11yClosed", transcript);
          this._closeA11y(false);
          return;
        }
        this._announce("voice.closed", transcript);
        this._closePanel();
        return;
      }
      if (id === "openA11y") {
        this._openA11y();
        this._announce("voice.a11yOpened", transcript);
        return;
      }
      if (id === "closeA11y") {
        this._announce("voice.a11yClosed", transcript);
        this._closeA11y(false);
        return;
      }
      if (id === "textReset") {
        this._setA11y({ textSize: 100 });
        this._announce("voice.textReset", transcript);
        return;
      }
      if (id === "spacingMore" || id === "spacingLess") {
        this._stepSpacing(id === "spacingMore" ? 20 : -20, transcript);
        return;
      }
      if (id === "resetAll") {
        this._setA11y(defaultA11y());
        this._announce("settings.resetDone", transcript);
        return;
      }
      if (id === "suggestLanguage") {
        this._openA11y();
        this._selectTab(this._filterIndex("display"));
        this._askArea();
        this._announce("area.checking", transcript);
        return;
      }
      if (id === "shareScreen") {
        this._voiceShare(transcript);
        return;
      }
      if (id === "stopSharing") {
        this._stopShare(true);
        this._announce("screen.ended", transcript);
        return;
      }
      if (id === "stopListening") {
        this._announce("voice.commandsOff", transcript);
        saveCommands(false);
        this._stopCommands();
        return;
      }
      if (id === "goBack") {
        this._announce("voice.goBack", transcript);
        history.back();
        return;
      }
      if (id === "reload") {
        this._announce("voice.reload", transcript);
        location.reload();
        return;
      }
      if (id === "readPage") {
        this._readPage(transcript);
        return;
      }
      if (id === "readSelected") {
        this._readSelection(transcript);
        return;
      }
      if (id === "stopReading") {
        this._stopSpoken();
        this._announce("voice.stopped", transcript);
        return;
      }
      if (id === "scrollUp") {
        this._scrollTo("up", transcript, "voice.scrolledUp");
        return;
      }
      if (id === "scrollDown") {
        this._scrollTo("down", transcript, "voice.scrolledDown");
        return;
      }
      if (id === "scrollTop") {
        this._scrollTo("top", transcript, "voice.scrolledTop");
        return;
      }
      if (id === "scrollBottom") {
        this._scrollTo("bottom", transcript, "voice.scrolledBottom");
        return;
      }
      if (id === "goToSection") {
        this._goToSection(hit.arg, transcript, mod);
        return;
      }
      if (id === "nextHeading") {
        this._moveHeading(1, transcript, "voice.nextHeading");
        return;
      }
      if (id === "previousHeading") {
        this._moveHeading(-1, transcript, "voice.previousHeading");
        return;
      }
      if (id === "textBigger") {
        this._stepText(10, transcript);
        return;
      }
      if (id === "textSmaller") {
        this._stepText(-10, transcript);
        return;
      }
      if (id === "changeLanguage") {
        this._changeLanguage(hit.arg, transcript, mod);
        return;
      }
      if (id === "talkPerson") {
        this._openHelp();
        this._announce("voice.talk", transcript);
        return;
      }
      if (id === "help") {
        this._showHelp(transcript);
        return;
      }
      this._status(fill(this._text("voice.unknown"), { phrase: transcript }));
    }

    _openPanel() {
      this._openChat();
    }

    /* The browser asks for a click before sharing a screen, so voice turns sharing on and moves focus to the start button. */
    _voiceShare(transcript) {
      var self = this;
      if (this._shareStream) {
        this._announce("screen.sharing", transcript);
        return;
      }
      if (!this._shareOn) {
        this._shareOn = true;
        saveShare(true);
      }
      this._openA11y();
      this._selectTab(this._filterIndex("display"));
      this._announce("voice.shareReady", transcript, {
        button: this._text("screen.start"),
      });
      Promise.resolve(this._renderShare()).then(function () {
        var target = [
          self._shareStart,
          self._shareSend,
          self._shareToggle,
        ].filter(function (el) {
          return el && !el.hidden;
        })[0];
        if (target) target.focus();
      });
    }

    _closePanel() {
      if (!this._dialog || !this._dialog.open) return;
      this._focusDone = false;
      this._afterClose = null;
      this._dialog.close();
    }

    _showHelp(transcript) {
      this._openA11y();
      var speechTab = this._filterIndex("speech");
      this._selectTab(speechTab);
      var list = this._commandLines().join(", ");
      this._announce("voice.help", transcript, { list: list });
      var line = this._statusText;
      this._speak(fill(this._text("voice.help"), { list: list }), this._lang, {
        restore: line,
      });
      if (this._tabs[speechTab]) this._tabs[speechTab].focus();
    }

    _readPage(transcript) {
      var text = this._pageText();
      if (!text) {
        this._announce("voice.emptyPage", transcript);
        return;
      }
      if (text.length > 8000)
        text = text.slice(0, 8000) + " " + this._text("voice.truncated");
      this._announce("voice.readingPage", transcript);
      this._speak(text, this._lang, { restore: this._statusText });
    }

    _readSelection(transcript) {
      var text = this._selectedText();
      if (!text) {
        if (transcript) this._announce("voice.nothingSelected", transcript);
        else this._status(this._text("voice.nothingSelected"));
        return;
      }
      if (transcript) this._announce("voice.readingSelected", transcript);
      else this._status(this._text("voice.readingSelected"));
      var anchor = null;
      try {
        var selection = window.getSelection && window.getSelection();
        anchor = selection && selection.anchorNode;
      } catch (err) {
        anchor = null;
      }
      this._speak(text, this._langOf(anchor, text), {
        restore: this._statusText,
        exact: true,
      });
    }

    _pageText() {
      var root = document.querySelector("main") || document.body;
      if (!root) return "";
      var clone = root.cloneNode(true);
      var skip = clone.querySelectorAll(
        "db-assistant, script, style, noscript",
      );
      for (var i = 0; i < skip.length; i += 1) skip[i].remove();
      return clean(clone.textContent || "");
    }

    _selectedText() {
      var text = "";
      try {
        var selection = window.getSelection && window.getSelection();
        if (selection) text = selection.toString();
      } catch (err) {
        text = "";
      }
      return clean(text);
    }

    _pageHeadings() {
      var all = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      var out = [];
      for (var i = 0; i < all.length; i += 1) {
        if (all[i].closest("db-assistant")) continue;
        if (!clean(all[i].textContent || "")) continue;
        out.push(all[i]);
      }
      return out;
    }

    _focusHeading(heading) {
      if (this._dialog && this._dialog.open) {
        this._afterClose = heading;
        this._focusDone = false;
        this._dialog.close();
        return;
      }
      focusHost(heading);
    }

    _moveHeading(step, transcript, key) {
      var headings = this._pageHeadings();
      if (!headings.length) {
        this._announce("voice.noHeading", transcript);
        return;
      }
      var current = 0;
      for (var i = 0; i < headings.length; i += 1) {
        if (headings[i].getBoundingClientRect().top <= 40) current = i;
      }
      var dest = current + step;
      if (dest < 0 || dest >= headings.length) {
        this._announce("voice.noHeading", transcript);
        return;
      }
      var name = clean(headings[dest].textContent);
      this._focusHeading(headings[dest]);
      this._announce(key, transcript, { name: name });
    }

    _goToSection(arg, transcript, mod) {
      if (!arg) {
        this._announce("voice.needSection", transcript);
        return;
      }
      var headings = this._pageHeadings();
      var names = [];
      for (var i = 0; i < headings.length; i += 1)
        names.push(headings[i].textContent || "");
      var index = mod.matchHeading(arg, names);
      if (index < 0) {
        this._announce("voice.noSection", transcript, { name: arg });
        return;
      }
      var name = clean(headings[index].textContent);
      this._focusHeading(headings[index]);
      this._announce("voice.wentTo", transcript, { name: name });
    }

    _changeLanguage(arg, transcript, mod) {
      if (!arg) {
        this._announce("voice.languageUnknown", transcript);
        return;
      }
      var maps = [];
      if (this._bundle && this._bundle.names) maps.push(this._bundle.names);
      if (englishPack.names) maps.push(englishPack.names);
      var native = {};
      for (var i = 0; i < this._languages.length; i += 1)
        native[this._languages[i].code] = this._languages[i].name;
      maps.push(native);
      var code = mod.matchLanguage(arg, maps);
      if (!code || !native[code]) {
        this._announce("voice.languageUnknown", transcript);
        return;
      }
      try {
        localStorage.setItem(LANG_KEY, code);
      } catch (err) {
        /* The choice still applies for this view. */
      }
      this._noteKey = "status.saved";
      this._announce("voice.languageChanged", transcript, {
        name: native[code],
      });
      this._load(code);
    }

    _scrollTo(kind, transcript, doneKey) {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      var step = Math.round(window.innerHeight * 0.6) || 200;
      var target = y;
      if (kind === "up") target = Math.max(0, y - step);
      else if (kind === "down") target = Math.min(max, y + step);
      else if (kind === "top") target = 0;
      else target = max;
      if (Math.abs(target - y) < 2) {
        this._announce("voice.noMove", transcript);
        return;
      }
      try {
        window.scrollTo({
          top: target,
          behavior: prefersStill() ? "auto" : "smooth",
        });
      } catch (err) {
        window.scrollTo(0, target);
      }
      this._announce(doneKey, transcript);
    }

    _focusInDialog(el) {
      if (!el || !el.isConnected) return;
      var parent = el.parentElement;
      while (parent) {
        if (parent.localName === "dialog" && !parent.open) return;
        parent = parent.parentElement;
      }
      el.focus();
    }

    _setAreaStatus(key) {
      this._areaStatusKey = key || "";
      this._setCardBusy(this._areaBtn, key === "area.checking");
      if (!this._areaStatus) return;
      var alert = key && key !== "area.checking";
      this._areaStatus.setAttribute("role", alert ? "alert" : "status");
      this._areaStatus.textContent = key ? this._text(key) : "";
    }

    _setPageStatus(key, extraKey) {
      this._pageStatusKey = key || "";
      this._pageStatusExtra = extraKey || "";
      window.clearTimeout(this._pageClearTimer);
      if (!this._pageStatus) return;
      var failed = key === "page.failed" || key === "page.notConnected";
      this._pageStatus.setAttribute(
        "role",
        key === "page.failed" ? "alert" : "status",
      );
      var text = key ? this._text(key) : "";
      if (extraKey)
        text = text ? text + " " + this._text(extraKey) : this._text(extraKey);
      this._pageStatus.textContent = text;
      if (key && key !== "pageLang.translating")
        this._clearPageStatusLater(failed ? 9000 : 4000);
    }

    /** Page messages are short-lived so the corner of the page stays clear. */
    _clearPageStatusLater(ms) {
      var self = this;
      window.clearTimeout(this._pageClearTimer);
      this._pageClearTimer = window.setTimeout(function () {
        self._pageClearTimer = 0;
        if (self._pageRunning || self._pageStarting) return;
        self._pageStatusKey = "";
        self._pageStatusExtra = "";
        if (self._pageStatus) self._pageStatus.textContent = "";
      }, ms);
    }

    _progressText() {
      return this._text("pageLang.translating");
    }

    _syncPageButtons() {
      var running = !!this._pageRunning;
      var busy = running || !!this._pageStarting;
      if (this._pageBusy) this._pageBusy.hidden = !busy;
      if (this._pageCancel) this._pageCancel.hidden = !running;
      if (this._pageOriginal) this._pageOriginal.hidden = true;
      if (this._pageLangHost)
        this._pageLangHost.classList.toggle("is-busy", busy);
      if (this._pageLangHost && !this._pageLangHost.hidden) {
        this._pageLangHost.setAttribute("aria-busy", busy ? "true" : "false");
      }
      if (this._langSelect) {
        if (busy) this._langSelect.setAttribute("aria-busy", "true");
        else this._langSelect.removeAttribute("aria-busy");
      }
      this._syncPageLangSelect();
    }

    _announcePageDone() {
      var self = this;
      if (this._pageDoneTimer) window.clearTimeout(this._pageDoneTimer);
      if (this._pageStatus) {
        this._pageStatus.setAttribute("role", "status");
        this._pageStatus.textContent = this._text("pageLang.translated");
      }
      this._pageDoneTimer = window.setTimeout(function () {
        self._pageDoneTimer = 0;
        if (self._pageRunning || !self._pageStats) return;
        self._renderPageReport();
      }, 1600);
    }

    /**
     * Saved language wins, and Not now is remembered. The clock zone only
     * offers Amharic. It does not change the language.
     */
    _maybeTimeZoneOffer() {
      if (
        !this._offer ||
        this._offerKind === "area" ||
        this._offerKind === "pick"
      )
        return;
      if (storedLanguage(this._languages)) {
        if (this._offerKind === "tz") this._hideOffer();
        return;
      }
      if (this._lang === "am" || timeZoneDismissed() || !inAddisZone()) {
        if (this._offerKind === "tz") this._hideOffer();
        return;
      }
      if (this._offerKind === "tz") return;
      this._showOffer("am", "tz");
    }

    _showOffer(code, kind) {
      var self = this;
      var generation = ++this._offerGeneration;
      this._offerKind = kind;
      this._offerCode = code;
      var pending =
        code === "en"
          ? fetchBundle("en")
          : Promise.all([fetchBundle("en"), fetchBundle(code)]).then(
              function (pair) {
                return mergeBundles(pair[0], pair[1]);
              },
            );
      pending
        .then(function (bundle) {
          if (generation !== self._offerGeneration || !self._offer) return;
          var name = languageNativeName(self._languages, code);
          self._offer.lang = code;
          self._offer.dir = code === "ar" ? "rtl" : "ltr";
          if (kind === "pick") {
            self._offer.setAttribute("role", "alertdialog");
            self._offer.setAttribute("aria-labelledby", "db-offer-title");
            self._offer.setAttribute("aria-describedby", "db-offer-consent");
          } else {
            self._offer.setAttribute("role", "status");
            self._offer.removeAttribute("aria-labelledby");
            self._offer.removeAttribute("aria-describedby");
          }
          self._offerText.textContent = fill(textAt(bundle, "area.suggest"), {
            name: name,
          });
          self._offerYes.textContent = textAt(bundle, "area.switch");
          self._offerNo.textContent = textAt(
            bundle,
            kind === "tz" ? "area.notNow" : "area.keep",
          );
          if (kind === "area") {
            self._offerGuess.hidden = false;
            self._offerGuess.textContent = textAt(bundle, "area.guess");
          } else {
            self._offerGuess.hidden = true;
            self._offerGuess.textContent = "";
          }
          var sendsPage = code !== "en";
          self._offerConsent.hidden = !sendsPage;
          self._offerConsent.textContent = sendsPage
            ? textAt(bundle, "page.consent")
            : "";
          self._offer.hidden = false;
          if (kind === "pick") {
            self._offerYes.focus();
          } else if (kind === "area") {
            try {
              self._offer.scrollIntoView({
                block: "nearest",
                behavior: "auto",
              });
            } catch (err) {
              /* The suggestion is already in the panel. */
            }
            self._focusInDialog(self._offerYes);
          }
        })
        .catch(function () {
          if (generation !== self._offerGeneration) return;
          self._hideOffer();
        });
    }

    _hideOffer() {
      var wasPick = this._offerKind === "pick";
      this._offerGeneration += 1;
      this._offerKind = "";
      this._offerCode = "";
      if (wasPick) {
        this._pendingLang = "";
        this._syncPageLangSelect();
      }
      if (!this._offer) return;
      var focused =
        (this._pageLangShadow && this._pageLangShadow.activeElement) ||
        (this._root && this._root.activeElement);
      var inside = focused && this._offer.contains(focused);
      this._offer.hidden = true;
      this._offerText.textContent = "";
      this._offerGuess.textContent = "";
      this._offerGuess.hidden = true;
      this._offerConsent.textContent = "";
      this._offerConsent.hidden = true;
      if (inside) this._focusLangControl();
    }

    /** Switching from a suggestion or from the picker translates the page right away. */
    _acceptOffer() {
      var code = this._offerCode;
      if (!code) return;
      this._commitPageLanguage(code);
    }

    _declineOffer() {
      var kind = this._offerKind;
      if (kind === "tz") {
        try {
          localStorage.setItem(TZ_DISMISS_KEY, "1");
        } catch (err) {
          /* This visit still hides the suggestion. */
        }
      }
      var back = kind === "area" ? this._areaBtn : null;
      this._hideOffer();
      if (kind === "area") this._maybeTimeZoneOffer();
      if (back) this._focusInDialog(back);
      else this._focusLangControl();
    }

    /**
     * The consent sentence is already on screen. Geolocation runs only from
     * this click. The coordinates are not stored and are not sent.
     */
    _askArea() {
      if (!window.isSecureContext) {
        this._setAreaStatus("area.insecure");
        return;
      }
      if (
        !navigator.geolocation ||
        typeof navigator.geolocation.getCurrentPosition !== "function"
      ) {
        this._setAreaStatus("area.unavailable");
        return;
      }
      this._setAreaStatus("area.checking");
      var self = this;
      var token = ++this._areaToken;
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var latitude =
            position && position.coords ? position.coords.latitude : NaN;
          var longitude =
            position && position.coords ? position.coords.longitude : NaN;
          if (token !== self._areaToken || !self.isConnected) return;
          self._useArea(latitude, longitude, token);
        },
        function (error) {
          if (token !== self._areaToken || !self.isConnected) return;
          var code = error && error.code;
          var key = "area.unavailable";
          if (code === 1) key = "area.denied";
          else if (code === 3) key = "area.timeout";
          self._setAreaStatus(key);
        },
        { enableHighAccuracy: false, timeout: 10000 },
      );
    }

    _useArea(latitude, longitude, token) {
      var self = this;
      import(new URL("regions.js", scriptUrl))
        .then(function (mod) {
          return mod.loadRegions().then(function (table) {
            return mod.matchArea(latitude, longitude, table);
          });
        })
        .then(function (result) {
          if (token !== self._areaToken || !self.isConnected) return;
          if (!result || !result.language) {
            self._setAreaStatus("area.unknown");
            return;
          }
          self._setAreaStatus("");
          self._showOffer(result.language, "area");
        })
        .catch(function () {
          if (token !== self._areaToken || !self.isConnected) return;
          self._setAreaStatus("area.unknown");
        });
    }

    _translationConfigured() {
      var self = this;
      if (!this._api) return Promise.resolve(false);
      return loadApiUrl()
        .then(function (mod) {
          var url = mod.apiUrl(self._api, "/v1/health", location.origin);
          if (!url) return false;
          return fetch(url, {
            headers: { accept: "application/json" },
            cache: "no-store",
          }).then(function (response) {
            if (!response.ok) return false;
            return response.json();
          });
        })
        .then(function (body) {
          return !!(body && body.ai === true);
        })
        .catch(function () {
          return false;
        });
    }

    _postTranslate(texts, signal, target) {
      var self = this;
      return loadApiUrl()
        .then(function (mod) {
          var url = mod.apiUrl(self._api, "/v1/translate", location.origin);
          if (!url) throw new Error("api");
          return fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ texts: texts, target: target }),
            signal: signal,
          });
        })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              if (!response.ok || !body || !Array.isArray(body.texts)) {
                var error = new Error("translate");
                error.reason = body && body.reason;
                throw error;
              }
              return body.texts;
            });
        });
    }

    _startPageTranslation() {
      var self = this;
      if (this._pageRunning || this._pageState || this._lang === "en") {
        this._pageStarting = false;
        if (!this._pageRunning && !this._pageState)
          this._setPageStatus("page.english");
        this._syncPageButtons();
        return;
      }
      var token = {};
      this._pageToken = token;
      import(new URL("page-translate.js", scriptUrl))
        .then(function (mod) {
          if (self._pageToken !== token || !self.isConnected) return null;
          self._pageMod = mod;
          if (mod.hostUsesGoogleTranslate(document)) {
            if (self._pageLangHost) self._pageLangHost.hidden = true;
            if (self._offerKind === "pick") self._hideOffer();
            self._pendingLang = "";
            self._pageStatusKey = "";
            if (self._pageStatus) self._pageStatus.textContent = "";
            return null;
          }
          return self._translationConfigured().then(function (ready) {
            if (self._pageToken !== token || !self.isConnected) return null;
            if (!ready) {
              self._setPageStatus("page.notConnected", "page.browserAlt");
              self._syncPageLangSelect();
              return null;
            }
            var target = self._lang;
            if (target === "en") {
              self._setPageStatus("page.english");
              self._syncPageLangSelect();
              return null;
            }
            var collected = mod.collectPageStrings(document);
            if (!collected.items.length) {
              self._pageStats = {
                translated: 0,
                failed: 0,
                capped: collected.capped,
                hidden: collected.hidden,
              };
              if (collected.capped || collected.hidden)
                self._renderPageReport();
              else self._setPageStatus("page.empty");
              self._syncPageLangSelect();
              return null;
            }
            self._pageRunning = true;
            self._pageStarting = false;
            self._pageAbort = new AbortController();
            self._pageKnown = {};
            self._pageUsed = mod.selectWithinCap(
              collected.items,
              mod.CHAR_CAP,
              null,
            ).characters;
            self._pageStatusKey = "";
            self._syncPageButtons();
            self._pageStatus.setAttribute("role", "status");
            self._pageStatus.textContent = self._progressText(
              0,
              collected.items.length,
            );
            self._focusInDialog(self._pageCancel);
            return mod
              .runPageTranslation({
                items: collected.items,
                lang: target,
                signal: self._pageAbort.signal,
                onProgress: function (done, total) {
                  if (self._pageToken !== token) return;
                  self._pageStatusKey = "";
                  self._pageStatus.setAttribute("role", "status");
                  self._pageStatus.textContent = self._progressText(
                    done,
                    total,
                  );
                },
                send: function (texts) {
                  return self._postTranslate(
                    texts,
                    self._pageAbort.signal,
                    target,
                  );
                },
              })
              .then(function (result) {
                if (self._pageToken !== token || !self.isConnected) return;
                var parents = null;
                var kept = [];
                try {
                  if (self._pageWatch) self._pageWatch.pause();
                  parents = mod.applyTranslations(
                    collected.items,
                    result.values,
                    target,
                    null,
                  );
                  for (var i = 0; i < collected.items.length; i += 1) {
                    if (result.values[i] != null) {
                      kept.push(collected.items[i]);
                      self._pageKnown[collected.items[i].core] = true;
                    }
                  }
                } catch (err) {
                  mod.restoreTranslations(
                    kept.length ? kept : collected.items,
                    parents,
                  );
                  throw err;
                }
                self._pageState = {
                  items: kept,
                  parents: parents,
                  target: target,
                };
                self._pageStats = {
                  translated: result.translated,
                  failed: result.failed,
                  capped: collected.capped,
                  hidden: collected.hidden,
                  reason: result.reason || "",
                };
                self._pageRunning = false;
                self._syncPageButtons();
                if (kept.length) {
                  self._startPageWatch(target);
                  self._announcePageDone();
                  self._focusLangControl();
                } else {
                  self._pageState = null;
                  self._renderPageReport();
                  self._focusLangControl();
                }
              });
          });
        })
        .catch(function (error) {
          if (self._pageToken !== token || !self.isConnected) return;
          if (self._pageState && self._pageMod) {
            self._pageMod.restoreTranslations(
              self._pageState.items,
              self._pageState.parents,
            );
            self._pageState = null;
          }
          self._pageRunning = false;
          self._pageAbort = null;
          var cancelled = error && error.name === "AbortError";
          self._setPageStatus(cancelled ? "page.cancelled" : "page.failed");
          self._syncPageButtons();
          self._focusLangControl();
        })
        .then(function () {
          if (self._pageToken !== token || !self._pageStarting) return;
          self._pageStarting = false;
          self._syncPageButtons();
        });
    }

    _cancelPageTranslation() {
      if (this._pageAbort) {
        try {
          this._pageAbort.abort();
        } catch (err) {
          /* The status line reports the cancel. */
        }
      }
    }

    _showOriginalPage() {
      this._pageToken = {};
      this._stopPageWatch();
      if (this._pageAbort) {
        try {
          this._pageAbort.abort();
        } catch (err) {
          /* Show original still puts the saved text back. */
        }
      }
      if (this._pageState && this._pageMod) {
        if (this._pageWatch) this._pageWatch.pause();
        this._pageMod.restoreTranslations(
          this._pageState.items,
          this._pageState.parents,
        );
      }
      this._pageState = null;
      this._pageStats = null;
      this._pageRunning = false;
      this._pageStarting = false;
      this._pageKnown = null;
      if (!this._holdPageStatus) this._setPageStatus("page.restored");
      this._syncPageButtons();
      if (!this._holdPageStatus) this._focusLangControl();
    }

    _stopPageWatch() {
      if (this._pageWatch) {
        this._pageWatch.stop();
        this._pageWatch = null;
      }
      this._pageQueue = [];
      this._pageWatchBusy = false;
    }

    _startPageWatch(target) {
      var self = this;
      this._stopPageWatch();
      if (!this._pageMod || !document.body) return;
      this._pageWatch = this._pageMod.watchPageAdditions(document, {
        delay: 300,
        onNodes: function (nodes) {
          if (!self._pageState) return;
          self._pageQueue = (self._pageQueue || []).concat(nodes);
          self._drainPageQueue(target);
        },
      });
    }

    _drainPageQueue(target) {
      var self = this;
      if (
        this._pageWatchBusy ||
        !this._pageState ||
        !this._pageQueue ||
        !this._pageQueue.length
      )
        return;
      var nodes = this._pageQueue.splice(0, this._pageQueue.length);
      var mod = this._pageMod;
      var gathered = mod.collectAdded(document, nodes);
      var ordered = mod.orderVisibleFirst(gathered.found);
      var selected = mod.selectWithinCap(
        ordered,
        mod.CHAR_CAP - this._pageUsed,
        this._pageKnown,
      );
      this._pageStats.hidden += gathered.hidden;
      this._pageStats.capped += gathered.tooLong + selected.capped;
      this._pageUsed += selected.characters;
      if (!selected.items.length) {
        this._renderPageReport();
        if (this._pageQueue.length) this._drainPageQueue(target);
        return;
      }
      this._pageWatchBusy = true;
      var token = this._pageToken;
      mod
        .runPageTranslation({
          items: selected.items,
          lang: target,
          signal: this._pageAbort ? this._pageAbort.signal : undefined,
          send: function (texts) {
            return self._postTranslate(
              texts,
              self._pageAbort && self._pageAbort.signal,
              target,
            );
          },
        })
        .then(function (result) {
          if (token !== self._pageToken || !self._pageState) return;
          if (self._pageWatch) self._pageWatch.pause();
          var parents = mod.applyTranslations(
            selected.items,
            result.values,
            target,
            self._pageState.parents,
          );
          self._pageState.parents = parents;
          for (var i = 0; i < selected.items.length; i += 1) {
            if (result.values[i] != null) {
              self._pageState.items.push(selected.items[i]);
              self._pageKnown[selected.items[i].core] = true;
            }
          }
          if (self._pageWatch) self._pageWatch.resume();
          self._pageStats.translated += result.translated;
          self._pageStats.failed += result.failed;
          if (result.reason) self._pageStats.reason = result.reason;
          self._renderPageReport();
        })
        .catch(function (error) {
          if (token !== self._pageToken || !self._pageState) return;
          if (error && error.name === "AbortError") return;
          self._pageStats.failed += selected.items.length;
          self._renderPageReport();
        })
        .then(function () {
          self._pageWatchBusy = false;
          if (self._pageState && self._pageQueue && self._pageQueue.length)
            self._drainPageQueue(target);
        });
    }

    _pageReasonText(reason) {
      var keys = {
        rate_limit: "page.reasonRateLimit",
        bad_key: "page.reasonBadKey",
        bad_model: "page.reasonBadModel",
        bad_response: "page.reasonBadResponse",
      };
      return keys[reason] ? this._text(keys[reason]) : "";
    }

    /** Only speaks up when nothing could be translated. Counts are not shown. */
    _renderPageReport() {
      if (!this._pageStatus || !this._pageStats || this._pageDoneTimer) return;
      var stats = this._pageStats;
      if (stats.translated > 0) {
        this._setPageStatus("");
        return;
      }
      var text =
        this._pageReasonText(stats.reason) ||
        this._text(stats.failed ? "page.failed" : "page.empty");
      this._pageStatusKey = "";
      this._pageStatus.setAttribute("role", stats.failed ? "alert" : "status");
      this._pageStatus.textContent = text;
      this._clearPageStatusLater(stats.failed ? 9000 : 4000);
    }

    _stopPageWork(restore) {
      this._pageToken = {};
      this._stopPageWatch();
      if (this._pageAbort) {
        try {
          this._pageAbort.abort();
        } catch (err) {
          /* The request is already finished. */
        }
        this._pageAbort = null;
      }
      var wasRunning = this._pageRunning || this._pageStarting;
      this._pageRunning = false;
      this._pageStarting = false;
      if (restore && this._pageState && this._pageMod) {
        this._pageMod.restoreTranslations(
          this._pageState.items,
          this._pageState.parents,
        );
        this._pageState = null;
        this._pageStats = null;
        this._pageKnown = null;
        this._pageStatusKey = "";
        this._pageStatusExtra = "";
        if (this._pageStatus) this._pageStatus.textContent = "";
      } else if (wasRunning) {
        this._setPageStatus("");
      }
      this._syncPageButtons();
    }

    _listenOnline() {
      if (this._onOnline) return;
      var self = this;
      this._onOnline = function () {
        self._flushOutbox();
      };
      window.addEventListener("online", this._onOnline);
    }

    _rememberHealth(body) {
      if (body && typeof body.telegram === "string")
        this._telegramFromHealth = body.telegram;
    }

    _cardIntro(iconName, plane) {
      var row = document.createElement("div");
      row.className = "card-top";
      var glyph = document.createElement("span");
      glyph.className = plane ? "card-icon plane" : "card-icon";
      glyph.setAttribute("aria-hidden", "true");
      glyph.appendChild(icon(iconName));
      var copy = document.createElement("div");
      copy.className = "card-copy";
      var title = document.createElement("h3");
      title.className = "card-title";
      var desc = paragraph("card-desc");
      copy.appendChild(title);
      copy.appendChild(desc);
      row.appendChild(glyph);
      row.appendChild(copy);
      row._title = title;
      row._desc = desc;
      return row;
    }

    _busyButton() {
      var el = button("text-btn is-primary");
      var spin = spinnerIcon();
      spin.setAttribute("hidden", "");
      var label = document.createElement("span");
      label.className = "btn-label";
      el.appendChild(spin);
      el.appendChild(label);
      el._face = { label: label, spin: spin };
      return el;
    }

    _resultCard(role) {
      var box = document.createElement("div");
      box.className =
        "person-result " + (role === "alert" ? "is-alert" : "is-status");
      box.setAttribute("role", role);
      box.hidden = true;
      var text = paragraph();
      var dismiss = button("icon-btn dismiss");
      dismiss.appendChild(icon("close"));
      box.appendChild(text);
      box.appendChild(dismiss);
      box._text = text;
      box._dismiss = dismiss;
      return box;
    }

    _buildPerson() {
      this._person = document.createElement("dialog");
      this._person.className = "person";
      this._person.setAttribute("aria-labelledby", "db-person-title");
      this._person.setAttribute("aria-describedby", "db-person-next");

      var head = document.createElement("div");
      head.className = "person-head";
      var mark = document.createElement("span");
      mark.className = "person-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.appendChild(icon("person"));
      this._personTitle = document.createElement("h2");
      this._personTitle.id = "db-person-title";
      this._personClose = button("icon-btn close");
      this._personClose.appendChild(icon("close"));
      head.appendChild(mark);
      head.appendChild(this._personTitle);
      head.appendChild(this._personClose);

      var wait = document.createElement("div");
      wait.className = "person-wait";
      var waitIcon = document.createElement("span");
      waitIcon.className = "card-icon";
      waitIcon.setAttribute("aria-hidden", "true");
      waitIcon.appendChild(icon("info"));
      this._personNext = paragraph();
      this._personNext.id = "db-person-next";
      wait.appendChild(waitIcon);
      wait.appendChild(this._personNext);

      var body = document.createElement("div");
      body.className = "person-body";
      this._personStatus = this._resultCard("status");
      this._personAlert = this._resultCard("alert");

      var leave = document.createElement("section");
      leave.className = "option-card";
      var leaveIntro = this._cardIntro("message");
      this._leaveTitle = leaveIntro._title;
      this._leaveDesc = leaveIntro._desc;
      this._personLabel = document.createElement("label");
      this._personLabel.htmlFor = "db-person-message";
      this._personInput = document.createElement("textarea");
      this._personInput.id = "db-person-message";
      this._personInput.rows = 3;
      this._personInput.maxLength = 2000;
      this._personInput.setAttribute(
        "aria-describedby",
        "db-person-count db-person-page",
      );
      this._charHint = paragraph("char-hint");
      this._charHint.id = "db-person-count";
      this._personPage = paragraph("help");
      this._personPage.id = "db-person-page";
      this._leaveBtn = this._busyButton();
      leave.appendChild(leaveIntro);
      leave.appendChild(this._personLabel);
      leave.appendChild(this._personInput);
      leave.appendChild(this._charHint);
      leave.appendChild(this._personPage);
      leave.appendChild(this._leaveBtn);

      var room = document.createElement("section");
      room.className = "option-card";
      var roomIntro = this._cardIntro("access");
      this._roomTitle = roomIntro._title;
      this._roomDesc = roomIntro._desc;
      this._roomCardBtn = this._busyButton();
      room.appendChild(roomIntro);
      room.appendChild(this._roomCardBtn);

      var telegram = document.createElement("section");
      telegram.className = "option-card";
      var telegramIntro = this._cardIntro("send", true);
      this._telegramTitle = telegramIntro._title;
      this._telegramDesc = telegramIntro._desc;
      this._topicField = document.createElement("div");
      this._topicField.className = "topic-field";
      this._topicLabel = document.createElement("label");
      this._topicLabel.htmlFor = "db-person-topic";
      this._topicSelect = document.createElement("select");
      this._topicSelect.id = "db-person-topic";
      this._topicOptions = [];
      var topics = ["tutor", "careers", "alerts", "accommodation"];
      for (var i = 0; i < topics.length; i += 1) {
        var option = document.createElement("option");
        option.value = topics[i];
        if (topics[i] === "careers") option.selected = true;
        this._topicSelect.appendChild(option);
        this._topicOptions.push(option);
      }
      this._topicField.appendChild(this._topicLabel);
      this._topicField.appendChild(this._topicSelect);
      this._telegramLink = document.createElement("a");
      this._telegramLink.className = "text-btn is-primary";
      this._telegramLink.target = "_blank";
      this._telegramLink.rel = "noopener noreferrer";
      this._telegramLink.href = "https://t.me/alxjobsbot?start=en_careers";
      this._telegramLabel = document.createElement("span");
      this._telegramLabel.className = "btn-label";
      this._telegramLink.appendChild(this._telegramLabel);
      this._telegramOpens = paragraph("card-note");
      this._telegramHelp = paragraph("help");
      this._telegramMissing = paragraph("help");
      this._telegramMissing.hidden = true;
      telegram.appendChild(telegramIntro);
      telegram.appendChild(this._topicField);
      telegram.appendChild(this._telegramLink);
      telegram.appendChild(this._telegramOpens);
      telegram.appendChild(this._telegramHelp);
      telegram.appendChild(this._telegramMissing);

      var sms = document.createElement("details");
      sms.className = "option-card person-sms";
      var summary = document.createElement("summary");
      var smsIcon = document.createElement("span");
      smsIcon.className = "card-icon";
      smsIcon.setAttribute("aria-hidden", "true");
      smsIcon.appendChild(icon("phone"));
      this._smsTitle = document.createElement("span");
      this._smsTitle.className = "card-title";
      summary.appendChild(smsIcon);
      summary.appendChild(this._smsTitle);
      this._smsDesc = paragraph("card-desc");
      this._smsBody = paragraph();
      sms.appendChild(summary);
      sms.appendChild(this._smsDesc);
      sms.appendChild(this._smsBody);

      var grid = document.createElement("div");
      grid.className = "person-grid";
      grid.appendChild(leave);
      grid.appendChild(room);
      grid.appendChild(telegram);
      grid.appendChild(sms);
      body.appendChild(this._personStatus);
      body.appendChild(this._personAlert);
      body.appendChild(grid);

      var foot = document.createElement("div");
      foot.className = "person-foot";
      this._personDone = button("text-btn");
      foot.appendChild(this._personDone);

      this._person.appendChild(head);
      this._person.appendChild(wait);
      this._person.appendChild(body);
      this._person.appendChild(foot);
    }

    _syncPersonText() {
      if (!this._personTitle) return;
      this._person.lang = this._lang;
      this._person.dir = directionOf(this._bundle);
      this._personTitle.textContent = this._text("escalate.title");
      this._labelIcon(this._personClose, this._text("escalate.close"));
      this._personDone.textContent = this._text("escalate.close");
      this._personNext.textContent = this._text("escalate.next");
      this._leaveTitle.textContent = this._text("escalate.leaveTitle");
      this._leaveDesc.textContent = this._text("escalate.leaveDesc");
      this._personLabel.textContent = this._text("escalate.messageLabel");
      this._personPage.textContent = this._text("escalate.pageNote");
      this._leaveBtn._face.label.textContent = this._text("composer.send");
      this._paintCharHint();
      this._roomTitle.textContent = this._text("escalate.accommodation");
      this._roomDesc.textContent = this._text("escalate.roomDesc");
      this._roomCardBtn._face.label.textContent = this._text("escalate.roomSend");
      this._telegramTitle.textContent = this._text("escalate.telegramChat");
      this._telegramDesc.textContent = this._text("escalate.telegramDesc");
      this._topicLabel.textContent = this._text("escalate.topic");
      var labels = [
        "escalate.topicTutor",
        "escalate.topicCareers",
        "escalate.topicAlerts",
        "escalate.topicAccommodation",
      ];
      for (var i = 0; i < this._topicOptions.length; i += 1) {
        this._topicOptions[i].textContent = this._text(labels[i]);
      }
      this._telegramLabel.textContent = this._text("escalate.telegramChat");
      this._telegramLink.setAttribute(
        "aria-label",
        this._text("escalate.telegramName"),
      );
      this._telegramHelp.textContent = this._text("escalate.telegramHelp");
      this._telegramMissing.textContent = this._text(
        "escalate.telegramMissing",
      );
      this._smsTitle.textContent = this._text("escalate.smsDemo");
      this._smsDesc.textContent = this._text("escalate.smsDesc");
      this._smsBody.textContent = this._text("escalate.smsBody");
      this._labelIcon(
        this._personStatus._dismiss,
        this._text("escalate.dismiss"),
      );
      this._labelIcon(
        this._personAlert._dismiss,
        this._text("escalate.dismiss"),
      );
      this._paintPersonStatus();
      this._syncTelegram();
    }

    _paintCharHint() {
      if (!this._charHint || !this._personInput) return;
      this._charHint.textContent = fill(this._text("escalate.charHint"), {
        count: this._personInput.value.length,
      });
    }

    _selectedTopic() {
      var value = this._topicSelect ? this._topicSelect.value : "";
      if (
        value !== "tutor" &&
        value !== "careers" &&
        value !== "alerts" &&
        value !== "accommodation"
      )
        return "";
      return value;
    }

    _ensureBot() {
      var self = this;
      return loadHelp().then(function (mod) {
        self._helpMod = mod;
        if (
          mod.cleanBot(self._telegram) ||
          mod.cleanBot(self._telegramFromHealth) ||
          !self._api
        )
          return mod;
        return loadApiUrl().then(function (api) {
          var url = api.apiUrl(self._api, "/v1/health", location.origin);
          return fetch(url, {
            headers: { accept: "application/json" },
            cache: "no-store",
          })
            .then(function (response) {
              if (!response.ok) return null;
              return response.json();
            })
            .then(function (body) {
              self._rememberHealth(body);
              return mod;
            })
            .catch(function () {
              return mod;
            });
        });
      });
    }

    _applyTelegram(bot) {
      if (!this._telegramLink) return;
      var name = bot || "alxjobsbot";
      var topic = this._selectedTopic();
      var codes = (this._languages || []).map(function (item) {
        return item.code;
      });
      var href = "https://t.me/" + name;
      if (topic && this._helpMod && this._helpMod.telegramUrl) {
        href =
          this._helpMod.telegramUrl(name, this._lang, topic, codes) || href;
      } else if (topic) {
        var lang = String(this._lang || "en").toLowerCase().split("-")[0];
        if (["en", "am", "om", "ti", "so", "ar"].indexOf(lang) === -1)
          lang = "en";
        href = "https://t.me/" + name + "?start=" + lang + "_" + topic;
      }
      this._telegramLink.href = href;
      this._telegramLink.hidden = false;
      this._telegramLink.target = "_blank";
      this._telegramLink.rel = "noopener noreferrer";
      if (this._telegramMissing) this._telegramMissing.hidden = true;
      if (this._telegramOpens) {
        this._telegramOpens.textContent = fill(
          this._text("escalate.telegramOpens"),
          { name: name },
        );
      }
    }

    _syncTelegram() {
      var self = this;
      if (!this._telegramLink) return;
      this._applyTelegram("alxjobsbot");
      this._ensureBot()
        .then(function (mod) {
          if (!self._telegramLink || !mod) return;
          var bot =
            mod.cleanBot(self._telegram) ||
            mod.cleanBot(self._telegramFromHealth) ||
            "alxjobsbot";
          self._applyTelegram(bot);
        })
        .catch(function () {
          if (!self._telegramLink) return;
          self._applyTelegram("alxjobsbot");
        });
    }

    _openHelp() {
      if (!this._person) return;
      if (!this._dialog.open) this._openPanel();
      this._helpFocusDone = false;
      this._syncPersonText();
      try {
        if (!this._person.open) this._person.showModal();
      } catch (err) {
        this._setTicketStatus("errors.generic");
        return;
      }
      this._personClose.focus();
    }

    _turns() {
      var items = this._log ? this._log.querySelectorAll(".msg") : [];
      var turns = [];
      for (var i = 0; i < items.length && turns.length < 39; i += 1) {
        var meta = items[i]._meta || {};
        var text =
          meta.kind === "miss"
            ? this._text("errors.notFound")
            : meta.kind === "advice"
              ? this._text("errors.advice")
              : clean(meta.text || "");
        if (!text) continue;
        turns.push({
          role: meta.role === "user" ? "learner" : "assistant",
          text: text.slice(0, 2000),
        });
      }
      return turns;
    }

    _pageSnapshot() {
      return {
        url: String(location.href || "").slice(0, 2000),
        heading: this._currentHeading().slice(0, 300),
        selection: this._selectedText().slice(0, 2000),
      };
    }

    _currentHeading() {
      var headings = this._pageHeadings();
      if (!headings.length) return "";
      var best = headings[0];
      var bestTop = -1e15;
      for (var i = 0; i < headings.length; i += 1) {
        var top = 0;
        try {
          top = headings[i].getBoundingClientRect().top;
        } catch (err) {
          top = 0;
        }
        if (top <= 120 && top >= bestTop) {
          best = headings[i];
          bestTop = top;
        }
      }
      return clean(best.textContent || "");
    }

    _jobsUrl() {
      try {
        var base = this._content
          ? new URL(this._content, location.href)
          : new URL("/demo/content.json", location.href);
        return new URL("data/jobs.json", base).href;
      } catch (err) {
        return "/demo/data/jobs.json";
      }
    }

    _jobContext(sections) {
      var list = sections || [];
      var jobs = [];
      for (var i = 0; i < list.length && jobs.length < 8; i += 1) {
        var section = list[i];
        var url = section.url || "";
        var id = section.id || "";
        if (url.indexOf("jobs.json") === -1 && id.indexOf("test-job-") !== 0)
          continue;
        jobs.push({
          title: section.title || "",
          url: url.slice(0, 500),
          text: (section.text || "").slice(0, 500),
        });
      }
      return jobs;
    }

    _loadJobs() {
      var self = this;
      return Promise.resolve(this._contentReady)
        .then(function () {
          var jobs = self._jobContext(self._sections);
          if (jobs.length) return jobs;
          return fetchJson(self._jobsUrl())
            .then(function (data) {
              return self._jobContext(sectionsFrom(data));
            })
            .catch(function () {
              return [];
            });
        })
        .catch(function () {
          return [];
        });
    }

    _leaveMessage() {
      if (this._sending) return;
      var extra = clean(this._personInput.value);
      var turns = this._turns();
      if (extra) turns.push({ role: "learner", text: extra.slice(0, 2000) });
      if (!turns.length) {
        this._setPersonStatus("escalate.empty");
        this._personInput.focus();
        return;
      }
      this._sendKind = "message";
      this._sendTicket({
        kind: "message",
        topic: this._selectedTopic() || "tutor",
        conversation: turns,
        page: this._pageSnapshot(),
        context: [],
        sentKey: "escalate.sent",
      });
    }

    _askRoom() {
      if (this._sending) return;
      var self = this;
      var turns = this._turns();
      turns.push({
        role: "learner",
        text: this._text("escalate.accommodation").slice(0, 2000),
      });
      this._sending = true;
      this._sendKind = "room";
      this._paintSending();
      this._loadJobs()
        .then(function (jobs) {
          self._sendTicket(
            {
              kind: "accommodation",
              topic: "accommodation",
              conversation: turns,
              page: self._pageSnapshot(),
              context: jobs,
              sentKey: jobs.length
                ? "escalate.accommodationSent"
                : "escalate.jobsMissing",
            },
            true,
          );
        })
        .catch(function () {
          self._sending = false;
          self._paintSending();
          self._showTicketResult("errors.generic");
        });
    }

    _sendPage() {
      if (this._sending) return;
      this._sendKind = "page";
      var turns = this._turns();
      turns.push({
        role: "learner",
        text: this._text("screen.sendPage").slice(0, 2000),
      });
      this._sendTicket({
        kind: "page",
        topic:
          this._person && this._person.open
            ? this._selectedTopic() || "tutor"
            : "tutor",
        conversation: turns,
        page: this._pageSnapshot(),
        context: [],
        sentKey: "screen.pageSent",
      });
    }

    _sendTicket(body, held) {
      var self = this;
      if (this._sending && !held) return;
      var stop = function () {
        self._sending = false;
        self._paintSending();
        self._paintCharHint();
      };
      if (!this._api) {
        this._sending = false;
        this._paintSending();
        this._showTicketResult("escalate.noApi");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueTicket(body);
        this._sending = false;
        this._paintSending();
        this._showTicketResult("escalate.saved");
        if (body.kind === "message" && this._personInput)
          this._personInput.value = "";
        this._paintCharHint();
        return;
      }
      this._sending = true;
      this._paintSending();
      this._postTicket(body).then(function (result) {
        stop();
        if (result.ticketId) {
          if (body.kind === "message" && self._personInput)
            self._personInput.value = "";
          self._paintCharHint();
          self._showTicketResult(
            body.sentKey || "escalate.sent",
            new Date().toISOString(),
          );
          self._emitEscalated(result.ticketId);
          return;
        }
        if (result.drop) {
          self._showTicketResult("errors.generic");
          return;
        }
        enqueueTicket(body);
        self._showTicketResult("escalate.saved");
        if (body.kind === "message" && self._personInput)
          self._personInput.value = "";
        self._paintCharHint();
      });
    }

    _setBusy(el, spin, disabled) {
      if (!el) return;
      el.disabled = !!disabled;
      if (spin) el.setAttribute("aria-busy", "true");
      else el.removeAttribute("aria-busy");
      if (el._face && el._face.spin) {
        if (spin) el._face.spin.removeAttribute("hidden");
        else el._face.spin.setAttribute("hidden", "");
      }
    }

    _paintSending() {
      var sending = !!this._sending;
      var kind = this._sendKind;
      this._setBusy(this._leaveBtn, sending && kind === "message", sending);
      this._setBusy(this._roomCardBtn, sending && kind === "room", sending);
      if (this._roomBtn) this._roomBtn.disabled = sending;
    }

    _dismissPersonResult(source) {
      var active = this._root && this._root.activeElement;
      this._setPersonStatus("");
      if (active === source && this._personDone) this._personDone.focus();
    }

    _showTicketResult(key, when) {
      if (when) this._ticketWhen = when;
      this._setTicketStatus(key);
      this._setPersonStatus(key);
    }

    _setTicketStatus(key) {
      this._ticketStatusKey = key || "";
      this._paintTicketStatus();
    }

    _paintTicketStatus() {
      if (!this._ticketStatus) return;
      var ticketText = this._ticketStatusKey
        ? this._text(this._ticketStatusKey)
        : "";
      this._ticketStatus.textContent = ticketText;
      this._ticketStatus.hidden = !this._ticketStatusKey;
      if (this._ticketStatusA11y) {
        this._ticketStatusA11y.textContent = ticketText;
        this._ticketStatusA11y.hidden = !this._ticketStatusKey;
      }
      this._paintTicketTime(this._ticketTime);
      this._paintTicketTime(this._ticketTimeA11y);
    }

    _paintTicketTime(el) {
      if (!el) return;
      if (!this._ticketWhen) {
        el.hidden = true;
        el.textContent = "";
        el.removeAttribute("datetime");
        return;
      }
      var when = this._ticketWhen;
      var lang = this._lang;
      var self = this;
      el.dateTime = when;
      el.lang = lang;
      loadCalendar()
        .then(function (mod) {
          if (self._ticketWhen !== when || self._lang !== lang) return;
          el.textContent = mod.formatShownDate(when, lang);
          el.hidden = !el.textContent;
        })
        .catch(function () {
          el.hidden = true;
        });
    }

    _setPersonStatus(key) {
      this._personStatusKey = key || "";
      this._paintPersonStatus();
    }

    _paintPersonStatus() {
      if (!this._personStatus || !this._personStatus._text) return;
      var key = this._personStatusKey || "";
      var text = key ? this._text(key) : "";
      var error =
        key === "escalate.empty" ||
        key === "escalate.noApi" ||
        key === "errors.generic";
      this._personStatus.hidden = !key || error;
      this._personAlert.hidden = !key || !error;
      this._personStatus._text.textContent = error ? "" : text;
      this._personAlert._text.textContent = error ? text : "";
      var shown = !key ? null : error ? this._personAlert : this._personStatus;
      if (
        shown &&
        this._person &&
        this._person.open &&
        shown.scrollIntoView
      ) {
        try {
          shown.scrollIntoView({ block: "nearest" });
        } catch (err) {
          /* Older browsers ignore the options object. */
        }
      }
    }

    _postTicket(body) {
      var self = this;
      if (!this._api) return Promise.resolve({ queued: true });
      return loadApiUrl()
        .then(function (mod) {
          var url = mod.apiUrl(self._api, "/v1/escalations", location.origin);
          return fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({
              language: body.language,
              topic: body.topic,
              conversation: body.conversation,
              page: body.page,
              context: body.context || [],
            }),
          }).then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (payload) {
                return {
                  ok: response.ok,
                  status: response.status,
                  payload: payload,
                };
              });
          });
        })
        .then(function (result) {
          if (result.ok && result.payload && result.payload.ticketId)
            return { ticketId: result.payload.ticketId };
          if (result.status === 400 || result.status === 413)
            return { drop: true };
          return { queued: true };
        })
        .catch(function () {
          return { queued: true };
        });
    }

    _flushOutbox() {
      if (this._flushing || !this._api) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false)
        return;
      if (!readOutbox().length) return;
      this._flushing = true;
      var self = this;
      var step = function () {
        var pending = readOutbox();
        if (!pending.length || !self.isConnected) {
          self._flushing = false;
          return;
        }
        var item = pending[0];
        var prepare = Promise.resolve(item);
        if (
          item.kind === "accommodation" &&
          (!item.context || !item.context.length)
        ) {
          prepare = self._loadJobs().then(function (jobs) {
            item.context = jobs;
            if (!item.sentKey)
              item.sentKey = jobs.length
                ? "escalate.accommodationSent"
                : "escalate.jobsMissing";
            return item;
          });
        }
        prepare
          .then(function (ready) {
            return self._postTicket(ready).then(function (result) {
              return { ready: ready, result: result };
            });
          })
          .then(function (done) {
            var result = done.result;
            if (result.queued) {
              self._flushing = false;
              self._showTicketResult("escalate.saved");
              return;
            }
            var rest = readOutbox();
            if (rest.length && rest[0].queuedAt === item.queuedAt) {
              rest.shift();
              writeOutbox(rest);
            }
            if (result.ticketId) {
              self._showTicketResult(
                item.sentKey || "escalate.sent",
                new Date().toISOString(),
              );
              self._emitEscalated(result.ticketId);
              step();
              return;
            }
            self._showTicketResult("errors.generic");
            step();
          })
          .catch(function () {
            self._flushing = false;
          });
      };
      step();
    }

    _emitEscalated(ticketId) {
      if (!ticketId) return;
      this.dispatchEvent(
        new CustomEvent("db-assistant:escalated", {
          bubbles: true,
          composed: true,
          detail: { ticketId: ticketId },
        }),
      );
    }

    _makeShareBar(fixed) {
      var root = document.createElement("div");
      root.className = fixed ? "share-bar share-fixed" : "share-bar";
      root.hidden = true;
      var text = paragraph();
      text.setAttribute("role", "status");
      var local = paragraph();
      var video = document.createElement("video");
      video.muted = true;
      video.setAttribute("playsinline", "");
      var stop = button("text-btn");
      root.appendChild(text);
      root.appendChild(local);
      root.appendChild(video);
      root.appendChild(stop);
      return { root: root, text: text, local: local, video: video, stop: stop };
    }

    _renderShare() {
      if (!this._shareToggle) return;
      var self = this;
      var on = this._shareOn === true;
      this._paintSwitch(
        this._shareToggle,
        this._text("screen.toggle"),
        this._text(on ? "settings.on" : "settings.off"),
        on,
        this._toggleText("screen.toggle", on),
      );
      this._paintShareBars();
      var hasApi = !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === "function"
      );
      return loadHelp()
        .then(function (mod) {
          if (!self._shareToggle) return;
          self._helpMod = mod;
          var supported = mod.screenShareSupported(navigator.userAgent, hasApi);
          var sharing = !!self._shareStream;
          self._shareStart.hidden = !(on && supported && !sharing);
          self._shareSend.hidden = !(on && !supported);
          self._shareSendHelp.hidden = !(on && !supported);
          self._shareUnsupported.hidden = supported;
          self._shareUnsupported.textContent = supported
            ? ""
            : self._text("screen.unsupported");
          self._syncShareBars();
        })
        .catch(function () {
          if (!self._shareToggle) return;
          self._shareStart.hidden = true;
          self._shareSend.hidden = !self._shareOn;
          self._shareSendHelp.hidden = !self._shareOn;
          self._shareUnsupported.hidden = false;
          self._shareUnsupported.textContent = self._text("screen.unsupported");
        });
    }

    _paintShareBars() {
      if (!this._bundle) return;
      var bars = [this._shareIn, this._shareOut];
      for (var i = 0; i < bars.length; i += 1) {
        if (!bars[i]) continue;
        bars[i].text.textContent = this._text("screen.sharing");
        bars[i].local.textContent = this._text("screen.local");
        bars[i].stop.textContent = this._text("screen.stop");
        bars[i].video.setAttribute("aria-label", this._text("screen.preview"));
      }
    }

    _syncShareBars() {
      var sharing = !!this._shareStream;
      var panelOpen = !!(this._a11yDialog && this._a11yDialog.open);
      if (this._shareIn) this._shareIn.root.hidden = !sharing || !panelOpen;
      if (this._shareOut) this._shareOut.root.hidden = !sharing || panelOpen;
    }

    _startShare() {
      var self = this;
      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getDisplayMedia !== "function"
      ) {
        this._setTicketStatus("screen.unsupported");
        this._renderShare();
        return;
      }
      Promise.resolve(
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }),
      )
        .then(function (stream) {
          self._attachShare(stream);
        })
        .catch(function (error) {
          var name = error && error.name;
          if (name === "NotAllowedError" || name === "AbortError")
            self._setTicketStatus("screen.denied");
          else if (name === "NotSupportedError")
            self._setTicketStatus("screen.unsupported");
          else self._setTicketStatus("screen.failed");
          self._renderShare();
        });
    }

    _attachShare(stream) {
      this._releaseShare();
      this._shareStream = stream;
      this._paintShareBars();
      var videos = [
        this._shareIn && this._shareIn.video,
        this._shareOut && this._shareOut.video,
      ];
      for (var i = 0; i < videos.length; i += 1) {
        if (!videos[i]) continue;
        videos[i].srcObject = stream;
        videos[i].muted = true;
      }
      var playTarget =
        this._a11yDialog && this._a11yDialog.open
          ? this._shareIn.video
          : this._shareOut.video;
      var play = playTarget.play();
      if (play && play.catch) play.catch(function () {});
      if (prefersStill()) {
        this._shareIn.video.pause();
        this._shareOut.video.pause();
      }
      var tracks = stream.getTracks();
      var self = this;
      for (var t = 0; t < tracks.length; t += 1) {
        tracks[t].addEventListener("ended", function () {
          if (!self._shareStream) return;
          self._stopShare(true);
          self._setTicketStatus("screen.ended");
        });
      }
      this._syncShareBars();
      this._renderShare();
      var stop =
        this._a11yDialog && this._a11yDialog.open
          ? this._shareIn.stop
          : this._shareOut.stop;
      if (stop) stop.focus();
    }

    _releaseShare() {
      var stream = this._shareStream;
      this._shareStream = null;
      if (stream) {
        var tracks = stream.getTracks();
        for (var i = 0; i < tracks.length; i += 1) {
          try {
            tracks[i].stop();
          } catch (err) {
            /* The track has already ended. */
          }
        }
      }
      if (this._shareIn && this._shareIn.video)
        this._shareIn.video.srcObject = null;
      if (this._shareOut && this._shareOut.video)
        this._shareOut.video.srcObject = null;
    }

    _stopShare(silent) {
      var was = !!this._shareStream;
      this._releaseShare();
      this._syncShareBars();
      if (this._shareToggle) this._renderShare();
      if (!silent && was) {
        this._setTicketStatus("screen.ended");
        var back =
          this._shareStart && !this._shareStart.hidden
            ? this._shareStart
            : this._shareToggle;
        if (back) {
          var target = back;
          window.setTimeout(function () {
            target.focus();
          }, 0);
        }
      }
    }
  }

  if (!customElements.get("db-assistant-lang")) {
    customElements.define(
      "db-assistant-lang",
      class DbAssistantLang extends HTMLElement {},
    );
  }

  if (!customElements.get("db-assistant")) {
    customElements.define("db-assistant", DbAssistant);
  }

  autoMount(bootScript);

  function autoMount(script) {
    if (!script || !scriptHasMountData(script)) return;
    if (script.getAttribute("data-db-mounted") === "1") return;
    script.setAttribute("data-db-mounted", "1");
    if (document.querySelector("db-assistant")) return;

    var el = document.createElement("db-assistant");
    el.setAttribute("lang", script.getAttribute("data-lang") || "auto");
    copyAttr(script, el, "data-api", "api");
    copyAttr(script, el, "data-content", "content");
    copyAttr(script, el, "data-theme", "theme");
    copyAttr(script, el, "data-provider", "provider");
    copyAttr(script, el, "data-telegram", "telegram");

    var attach = function () {
      if (!document.body || document.querySelector("db-assistant")) return;
      document.body.appendChild(el);
    };
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach, { once: true });
  }

  function scriptHasMountData(script) {
    return (
      script.hasAttribute("data-lang") ||
      script.hasAttribute("data-api") ||
      script.hasAttribute("data-content") ||
      script.hasAttribute("data-theme") ||
      script.hasAttribute("data-provider") ||
      script.hasAttribute("data-telegram")
    );
  }

  function copyAttr(from, to, fromName, toName) {
    if (!from.hasAttribute(fromName)) return;
    to.setAttribute(toName, from.getAttribute(fromName));
  }
})();
