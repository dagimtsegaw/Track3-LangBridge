/**
 * Telegram deep link and screen-share detection.
 * The bot itself is not in this repository. The widget only builds the link.
 *
 * start payload: <lang>_<topic>
 *   lang: a code from languages.json (anything else becomes en)
 *   topic: tutor, careers, alerts, accommodation (anything else becomes tutor)
 * Example: https://t.me/ExampleBot?start=am_accommodation
 */

var TOPICS = ["tutor", "careers", "alerts", "accommodation"];

function cleanBot(value) {
  var name = String(value || "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(name)) return "";
  return name;
}

function startPayload(lang, topic, codes) {
  var list = Array.isArray(codes) ? codes : [];
  var code = String(lang || "en").toLowerCase().split("-")[0];
  if (list.indexOf(code) === -1) code = "en";
  var picked = TOPICS.indexOf(String(topic || "")) === -1 ? "tutor" : String(topic);
  return code + "_" + picked;
}

function telegramUrl(bot, lang, topic, codes) {
  var name = cleanBot(bot);
  if (!name) return "";
  return "https://t.me/" + name + "?start=" + startPayload(lang, topic, codes);
}

/**
 * Chrome for Android exposes getDisplayMedia in some versions and still
 * cannot share the screen. Treat that browser as unsupported.
 */
function screenShareSupported(ua, hasApi) {
  if (!hasApi) return false;
  var agent = String(ua || "");
  var android = /Android/i.test(agent);
  var chrome = /Chrome\/\d+/i.test(agent);
  var other = /EdgA|OPR|SamsungBrowser|Firefox|UCBrowser/i.test(agent);
  if (android && chrome && !other) return false;
  return true;
}

export { TOPICS, cleanBot, startPayload, telegramUrl, screenShareSupported };
