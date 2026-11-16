/** In-memory counter per IP. Old rows are dropped so the map cannot grow forever. */

export function rateLimit(options) {
  const windowMs = (options && options.windowMs) || 60 * 1000;
  const max = (options && options.max) || 60;
  const hits = new Map();
  return function limit(req, res, next) {
    if (req.method === "OPTIONS") return next();
    const now = Date.now();
    const ip = req.ip || "unknown";
    let row = hits.get(ip);
    if (!row || now >= row.reset) {
      row = { count: 0, reset: now + windowMs };
      hits.set(ip, row);
    }
    row.count += 1;
    if (hits.size > 5000) {
      for (const [key, value] of hits) {
        if (now >= value.reset) hits.delete(key);
      }
    }
    if (row.count > max) {
      const wait = Math.max(1, Math.ceil((row.reset - now) / 1000));
      res.set("retry-after", String(wait));
      return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    }
    return next();
  };
}
