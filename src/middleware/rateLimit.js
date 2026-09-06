// Small in-memory rate limiter — no extra dependency needed for a
// single-instance personal deployment. Not suitable for multi-instance scaling.
// Keyed by a caller-supplied function rather than IP alone: behind Railway's
// proxy every request can appear to share one IP, so IP-only keys risk one
// user's requests exhausting another user's budget. Defaulting to a
// username-aware key keeps unrelated accounts from blocking each other.

const buckets = new Map(); // key -> { count, resetAt }

function rateLimit({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = keyFn ? keyFn(req, ip) : ip;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    next();
  };
}

// Periodically clear stale buckets so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

module.exports = rateLimit;
