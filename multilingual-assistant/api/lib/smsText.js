/** GSM-style cap is 160 characters. The source is a section title, not a URL. */

const LIMIT = 160;
const NOT_FOUND = "Couldn't find this. Talk to a person.";

export function fitSms(result) {
  if (!result || !result.text) return NOT_FOUND.slice(0, LIMIT);
  const title = String((result.sources && result.sources[0] && result.sources[0].title) || "")
    .replace(/\s+/g, " ")
    .trim();
  const body = String(result.text).replace(/\s+/g, " ").trim();
  const suffix = title ? " (" + title + ")" : "";
  if ((body + suffix).length <= LIMIT) return body + suffix;
  if (suffix.length >= LIMIT - 1) {
    const both = (body + " " + title).replace(/\s+/g, " ").trim();
    return both.length <= LIMIT ? both : both.slice(0, LIMIT - 1) + "…";
  }
  const room = LIMIT - suffix.length - 1;
  return body.slice(0, room).trimEnd() + "…" + suffix;
}
