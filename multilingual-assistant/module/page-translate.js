/**
 * Opt-in translation of the host page.
 * Walks the whole body. Visible text goes first, in document order, then
 * the rest. Identical strings are sent once. Originals are kept so Show
 * original can put them back. Tags, ids, classes, and event handlers stay.
 * Replacements are nodeValue and setAttribute only.
 *
 * The API accepts at most 20 strings per request and 2000 characters each.
 * This file sends at most that many, or about 3000 characters, per request.
 */

export var BATCH_COUNT = 20;
export var BATCH_CHARS = 3000;
export var CHAR_CAP = 60000;
export var ITEM_MAX = 2000;

var SKIP = {
  SCRIPT: true,
  STYLE: true,
  NOSCRIPT: true,
  CODE: true,
  PRE: true,
  SELECT: true,
  SVG: true,
  TEMPLATE: true,
};

var ATTRS = ["alt", "title", "aria-label", "placeholder"];
var NUMBERISH = /^[\d\s\p{P}\p{S}]+$/u;

export function textHash(value) {
  var h = 5381;
  var text = String(value);
  for (var i = 0; i < text.length; i += 1) {
    h = Math.imul(h, 33) + text.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function hostUsesGoogleTranslate(doc) {
  var root = doc && doc.documentElement;
  if (!root) return false;
  if (root.classList.contains("translated-ltr") || root.classList.contains("translated-rtl")) return true;
  if (doc.getElementById("google_translate_element")) return true;
  try {
    if (doc.querySelector(".goog-te-combo")) return true;
  } catch (err) {
    return false;
  }
  return false;
}

function editable(el) {
  if (!el || !el.getAttribute) return false;
  var value = el.getAttribute("contenteditable");
  return value != null && value.toLowerCase() !== "false";
}

function hiddenElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hidden || el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  var view = el.ownerDocument && el.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return false;
  var style = view.getComputedStyle(el);
  if (!style) return false;
  return style.display === "none" || style.visibility === "hidden";
}

function skipBranch(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.tagName === "DB-ASSISTANT" || SKIP[el.tagName] === true || editable(el)) return true;
  return false;
}

function classify(text) {
  var raw = String(text == null ? "" : text);
  var match = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  var core = match[2];
  if (!core || !core.trim()) return null;
  if (NUMBERISH.test(core.trim())) return null;
  return { lead: match[1], core: core, trail: match[3], tooLong: core.length > ITEM_MAX };
}

function isHidden(el, cache) {
  if (!el || el.nodeType !== 1) return false;
  if (cache.has(el)) return cache.get(el);
  var parentHidden = el.parentElement ? isHidden(el.parentElement, cache) : false;
  var result = parentHidden || hiddenElement(el);
  cache.set(el, result);
  return result;
}

function inView(el) {
  if (!el || !el.getBoundingClientRect) return false;
  var rect = el.getBoundingClientRect();
  var view = el.ownerDocument && el.ownerDocument.defaultView;
  var height = view && view.innerHeight ? view.innerHeight : 0;
  var width = view && view.innerWidth ? view.innerWidth : 0;
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
}

function attrsOf(el) {
  var names = ATTRS.slice();
  if (el.tagName === "INPUT") {
    var type = String(el.getAttribute("type") || "text").toLowerCase();
    if (type === "button" || type === "submit") names.push("value");
  }
  return names;
}

function remember(bucket, hidden, parts, item) {
  if (!parts) return;
  if (parts.tooLong) {
    bucket.tooLong += 1;
    return;
  }
  if (hidden) {
    bucket.hidden += 1;
    return;
  }
  item.lead = parts.lead;
  item.core = parts.core;
  item.trail = parts.trail;
  item.order = bucket.order;
  bucket.order += 1;
  bucket.found.push(item);
}

function takeElement(bucket, el, hidden) {
  var names = attrsOf(el);
  var anchor = el;
  var visible = hidden ? 1 : inView(anchor) ? 0 : 1;
  for (var i = 0; i < names.length; i += 1) {
    if (!el.hasAttribute(names[i])) continue;
    var parts = classify(el.getAttribute(names[i]));
    remember(bucket, hidden, parts, {
      kind: "attr",
      element: el,
      attr: names[i],
      original: el.getAttribute(names[i]),
      visible: visible,
    });
  }
}

function takeText(bucket, textNode, hidden) {
  var parent = textNode.parentElement;
  if (!parent) return;
  if (parent.tagName === "INPUT" || parent.tagName === "TEXTAREA") return;
  var parts = classify(textNode.nodeValue);
  remember(bucket, hidden, parts, {
    kind: "text",
    node: textNode,
    original: textNode.nodeValue,
    visible: hidden ? 1 : inView(parent) ? 0 : 1,
  });
}

/**
 * found is document order. hidden counts strings we could have translated
 * but left because they are not shown. tooLong counts strings over the
 * per-request character limit.
 */
export function gatherTree(doc, root) {
  var bucket = { found: [], hidden: 0, tooLong: 0, order: 0 };
  if (!root || !doc || !doc.defaultView) return bucket;
  var Filter = doc.defaultView.NodeFilter;
  var cache = new WeakMap();
  if (root.nodeType === 3) {
    var parent = root.parentElement;
    if (parent && !skipBranch(parent)) takeText(bucket, root, isHidden(parent, cache));
    return bucket;
  }
  if (root.nodeType !== 1 || skipBranch(root)) return bucket;
  takeElement(bucket, root, isHidden(root, cache));
  var walker = doc.createTreeWalker(root, Filter.SHOW_ELEMENT | Filter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (node.nodeType === 1) {
        if (skipBranch(node)) return Filter.FILTER_REJECT;
        return Filter.FILTER_ACCEPT;
      }
      var host = node.parentElement;
      if (!host || skipBranch(host)) return Filter.FILTER_REJECT;
      if (host.tagName === "INPUT" || host.tagName === "TEXTAREA") return Filter.FILTER_REJECT;
      return Filter.FILTER_ACCEPT;
    },
  });
  var node = walker.nextNode();
  while (node) {
    if (node.nodeType === 1) takeElement(bucket, node, isHidden(node, cache));
    else takeText(bucket, node, isHidden(node.parentElement, cache));
    node = walker.nextNode();
  }
  return bucket;
}

/** Visible strings first, each group kept in document order. */
export function orderVisibleFirst(found) {
  var copy = found.slice();
  copy.sort(function (a, b) {
    if (a.visible !== b.visible) return a.visible - b.visible;
    return a.order - b.order;
  });
  return copy;
}

/**
 * cap is a character budget. A repeated string does not spend it again.
 * known cores (already translated) are kept and do not spend the budget.
 */
export function selectWithinCap(items, cap, known) {
  var chosen = [];
  var seen = new Map();
  var prior = known || {};
  var capped = 0;
  var used = 0;
  var limit = Number(cap);
  if (!Number.isFinite(limit) || limit < 0) limit = 0;
  for (var i = 0; i < items.length; i += 1) {
    var core = items[i].core;
    if (prior[core] === true || seen.get(core) === true) {
      chosen.push(items[i]);
      continue;
    }
    if (seen.get(core) === false) {
      capped += 1;
      continue;
    }
    if (used + core.length > limit) {
      seen.set(core, false);
      capped += 1;
      continue;
    }
    seen.set(core, true);
    used += core.length;
    chosen.push(items[i]);
  }
  return { items: chosen, capped: capped, characters: used };
}

export function collectPageStrings(doc) {
  var body = doc && doc.body;
  if (!body) return { items: [], hidden: 0, capped: 0 };
  var gathered = gatherTree(doc, body);
  var selected = selectWithinCap(orderVisibleFirst(gathered.found), CHAR_CAP, null);
  return {
    items: selected.items,
    hidden: gathered.hidden,
    capped: gathered.tooLong + selected.capped,
  };
}

export function collectAdded(doc, nodes) {
  var found = [];
  var hidden = 0;
  var tooLong = 0;
  var list = nodes || [];
  for (var i = 0; i < list.length; i += 1) {
    var node = list[i];
    if (!node || !node.isConnected) continue;
    var gathered = gatherTree(doc, node);
    found = found.concat(gathered.found);
    hidden += gathered.hidden;
    tooLong += gathered.tooLong;
  }
  return { found: found, hidden: hidden, tooLong: tooLong };
}

export function applyTranslations(items, strings, lang, parents) {
  var map = parents || new Map();
  var i;
  for (i = 0; i < items.length; i += 1) {
    if (strings[i] == null) continue;
    var item = items[i];
    var parent = item.kind === "text" ? item.node.parentElement : item.element;
    if (!parent || map.has(parent)) continue;
    map.set(parent, {
      lang: parent.getAttribute("lang"),
      dir: parent.getAttribute("dir"),
      changedLang: false,
      changedDir: false,
    });
  }
  for (i = 0; i < items.length; i += 1) {
    if (strings[i] == null) continue;
    var item = items[i];
    var next = item.lead + strings[i] + item.trail;
    var parent = item.kind === "text" ? item.node.parentElement : item.element;
    if (item.kind === "text") item.node.nodeValue = next;
    else item.element.setAttribute(item.attr, next);
    var saved = parent && map.get(parent);
    if (!saved) continue;
    if (!saved.changedLang && saved.lang !== lang) {
      parent.setAttribute("lang", lang);
      saved.changedLang = true;
    }
    if (lang === "ar" && !saved.changedDir && saved.dir !== "rtl") {
      parent.setAttribute("dir", "rtl");
      saved.changedDir = true;
    }
  }
  return map;
}

export function restoreTranslations(items, parents) {
  var i;
  for (i = 0; i < items.length; i += 1) {
    var item = items[i];
    if (item.kind === "text") {
      if (item.node) item.node.nodeValue = item.original;
    } else if (item.element) {
      item.element.setAttribute(item.attr, item.original);
    }
  }
  if (!parents) return;
  parents.forEach(function (saved, el) {
    if (!el) return;
    if (saved.changedLang) {
      if (saved.lang == null) el.removeAttribute("lang");
      else el.setAttribute("lang", saved.lang);
    }
    if (saved.changedDir) {
      if (saved.dir == null) el.removeAttribute("dir");
      else el.setAttribute("dir", saved.dir);
    }
  });
}

function cacheKey(lang, text) {
  return "db-assistant:tr:" + lang + ":" + textHash(text) + ":" + String(text.length);
}

export function readPageCache(lang, text) {
  try {
    var raw = sessionStorage.getItem(cacheKey(lang, text));
    if (!raw) return "";
    var data = JSON.parse(raw);
    if (!data || data.s !== text || typeof data.t !== "string" || !data.t) return "";
    return data.t;
  } catch (err) {
    return "";
  }
}

export function writePageCache(lang, text, translated) {
  if (!translated) return;
  try {
    sessionStorage.setItem(cacheKey(lang, text), JSON.stringify({ s: text, t: translated }));
  } catch (err) {
    /* The page can still show this translation. The next visit may send it again. */
  }
}

function aborted() {
  var error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

function uniquePlan(items) {
  var cores = [];
  var groups = [];
  var index = new Map();
  for (var i = 0; i < items.length; i += 1) {
    var core = items[i].core;
    if (!index.has(core)) {
      index.set(core, cores.length);
      cores.push(core);
      groups.push([]);
    }
    groups[index.get(core)].push(i);
  }
  return { cores: cores, groups: groups };
}

function terminalReason(reason) {
  return reason === "rate_limit" || reason === "bad_key" || reason === "bad_model";
}

async function trySend(texts, send, signal) {
  if (signal && signal.aborted) throw aborted();
  try {
    var translated = await send(texts);
    if (signal && signal.aborted) throw aborted();
    if (!Array.isArray(translated) || translated.length !== texts.length) {
      return { ok: false, reason: "bad_response" };
    }
    return {
      ok: true,
      values: translated.map(function (item, i) {
        return typeof item === "string" && item.trim() ? item : texts[i];
      }),
    };
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    if (signal && signal.aborted) throw aborted();
    return { ok: false, reason: (err && err.reason) || "" };
  }
}

/**
 * Try the batch, retry it once, then try the two halves once each.
 * A key, model, or rate-limit failure stops there. A string that still
 * has no translation comes back null.
 */
async function sendWithRetry(texts, send, signal) {
  var blanks = function (list) {
    return list.map(function () { return null; });
  };
  var first = await trySend(texts, send, signal);
  if (first.ok) return { values: first.values, reason: "" };
  if (terminalReason(first.reason)) return { values: blanks(texts), reason: first.reason };
  var second = await trySend(texts, send, signal);
  if (second.ok) return { values: second.values, reason: "" };
  var reason = second.reason || first.reason || "";
  if (terminalReason(reason) || texts.length < 2) return { values: blanks(texts), reason: reason };
  var mid = Math.ceil(texts.length / 2);
  var left = await trySend(texts.slice(0, mid), send, signal);
  var right = await trySend(texts.slice(mid), send, signal);
  var leftValues = left.ok ? left.values : blanks(texts.slice(0, mid));
  var rightValues = right.ok ? right.values : blanks(texts.slice(mid));
  return {
    values: leftValues.concat(rightValues),
    reason: (!left.ok && left.reason) || (!right.ok && right.reason) || "",
  };
}

export async function runPageTranslation(options) {
  var items = options.items || [];
  var lang = options.lang;
  var signal = options.signal;
  var onProgress = options.onProgress || function () {};
  var send = options.send;
  var batchCount = options.batchCount || BATCH_COUNT;
  var batchChars = options.batchChars || BATCH_CHARS;
  var plan = uniquePlan(items);
  var values = new Array(items.length);
  var pending = [];
  var done = 0;
  var reason = "";
  var i;
  for (i = 0; i < plan.cores.length; i += 1) {
    var hit = readPageCache(lang, plan.cores[i]);
    if (hit) {
      var members = plan.groups[i];
      for (var m = 0; m < members.length; m += 1) values[members[m]] = hit;
      done += members.length;
    } else {
      pending.push(i);
    }
  }
  onProgress(done, items.length);
  var cursor = 0;
  while (cursor < pending.length) {
    if (signal && signal.aborted) throw aborted();
    var batch = [];
    var chars = 0;
    while (cursor < pending.length && batch.length < batchCount) {
      var core = plan.cores[pending[cursor]];
      if (batch.length > 0 && chars + core.length > batchChars) break;
      chars += core.length;
      batch.push(pending[cursor]);
      cursor += 1;
    }
    var texts = [];
    for (i = 0; i < batch.length; i += 1) texts.push(plan.cores[batch[i]]);
    var translated = await sendWithRetry(texts, send, signal);
    if (translated.reason) reason = translated.reason;
    for (i = 0; i < batch.length; i += 1) {
      var group = plan.groups[batch[i]];
      var value = translated.values[i];
      if (value) writePageCache(lang, texts[i], value);
      for (var g = 0; g < group.length; g += 1) {
        values[group[g]] = value || null;
        done += 1;
      }
    }
    onProgress(done, items.length);
  }
  var translatedCount = 0;
  var failed = 0;
  for (i = 0; i < values.length; i += 1) {
    if (values[i]) translatedCount += 1;
    else failed += 1;
  }
  return { values: values, translated: translatedCount, failed: failed, reason: reason };
}

/**
 * Watch the body for text the host adds after the first pass.
 * Call pause() around our own writes so they are not translated again.
 */
export function watchPageAdditions(doc, options) {
  var delay = options.delay || 300;
  var timer = null;
  var queue = [];
  var observer = new doc.defaultView.MutationObserver(function (records) {
    for (var i = 0; i < records.length; i += 1) {
      var record = records[i];
      if (record.type === "childList") {
        record.addedNodes.forEach(function (node) {
          queue.push(node);
        });
      } else {
        queue.push(record.target);
      }
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      var batch = queue.splice(0, queue.length);
      if (batch.length) options.onNodes(batch);
    }, delay);
  });
  var config = {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["alt", "title", "aria-label", "placeholder", "value"],
  };
  function resume() {
    if (doc.body) observer.observe(doc.body, config);
  }
  resume();
  return {
    pause: function () {
      if (timer) clearTimeout(timer);
      timer = null;
      queue = [];
      observer.disconnect();
    },
    resume: resume,
    stop: function () {
      if (timer) clearTimeout(timer);
      timer = null;
      queue = [];
      observer.disconnect();
    },
  };
}
