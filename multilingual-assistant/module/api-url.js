/**
 * Join data-api with a /v1 path.
 * An http(s) base is used as written.
 * Any other base is rooted at the origin, never at the page's folder.
 * A trailing slash on the base is removed so the path is not doubled.
 */

export function apiUrl(apiBase, path, origin) {
  var base = String(apiBase || "").trim().replace(/\/+$/, "");
  var suffix = String(path || "");
  if (suffix.charAt(0) !== "/") suffix = "/" + suffix;
  if (!base) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(base) || base.slice(0, 2) === "//") {
    return base + suffix;
  }
  var root = String(origin || "").replace(/\/+$/, "");
  if (base.charAt(0) !== "/") base = "/" + base;
  return root + base + suffix;
}
