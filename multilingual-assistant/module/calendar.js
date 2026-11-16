/**
 * Dates shown to people. Amharic, Tigrinya, and Afaan Oromoo use the Ethiopian
 * calendar. Every other language stays on the Gregorian calendar.
 */

const ETHIOPIC = { am: true, ti: true, om: true };

export function formatShownDate(value, lang) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const code = String(lang || "").toLowerCase().split("-")[0];
  const locale = ETHIOPIC[code] ? "am-ET-u-ca-ethiopic" : gregorianLocale(code);
  const options = { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }
}

function gregorianLocale(code) {
  if (code === "ar") return "ar";
  if (code === "so") return "so";
  return "en-GB";
}
