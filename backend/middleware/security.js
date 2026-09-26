// Security & High-Traffic Middleware Suite
// Protects against NoSQL injection, XSS, MIME sniffing, Clickjacking, and API flood attacks

/**
 * Defensive Security Headers Middleware
 */
export const securityHeaders = (req, res, next) => {
  // Prevent browsers from MIME-sniffing a response away from declared content-type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent site from being rendered inside an iframe (Clickjacking defense)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Enable legacy cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS connection
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy: Grant camera/microphone for mock interview while blocking third-party abuse
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

  // Remove Express footprint identifier
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Deep Input Sanitizer to block NoSQL Injection ($ keys or . operators)
 */
const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block MongoDB query operator injection ($gt, $ne, $where, etc.)
    if (key.startsWith('$') || key.includes('.')) {
      continue; // Strip malicious key
    }
    cleaned[key] = cleanObject(value);
  }
  return cleaned;
};

export const sanitizeInputs = (req, res, next) => {
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);
  next();
};

/**
 * High-Performance Sliding Window Rate Limiter
 * Tracks client IP requests in-memory with automatic garbage collection
 */
export const createRateLimiter = ({ windowMs = 60 * 1000, max = 200, message = 'Too many requests, please try again later.' } = {}) => {
  const ipStore = new Map();

  // Periodic cleanup of stale IP records every 2 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      if (now - record.resetTime > windowMs) {
        ipStore.delete(ip);
      }
    }
  }, 2 * 60 * 1000).unref(); // unref so timer doesn't keep node process open if shutting down

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = ipStore.get(ip);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      ipStore.set(ip, record);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    record.count++;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: message,
        retryAfter: retryAfterSeconds
      });
    }

    next();
  };
};

// Global API limiter: 300 req / min per IP
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'API rate limit exceeded. Please wait a moment before sending more requests.'
});

// Sensitive Auth limiter: 40 req / 15 mins per IP
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

// AI & Heavy Generation limiter: 60 req / min per IP
export const aiGenerationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'AI generation throughput limit reached. Please allow a few seconds between interview/question generations.'
});
