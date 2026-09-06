// Small in-memory per-IP rate limiter — no extra dependency needed for a
// single-instance personal deployment. Not suitable for multi-instance scaling.

const buckets = new Map(); // ip -> { count, resetAt }

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
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
  for (const [ip, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(ip);
  }
}, 10 * 60 * 1000).unref();

module.exports = rateLimit;
