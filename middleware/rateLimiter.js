/**
 * Simple in-memory rate limiter
 * In production, use Redis for distributed rate limiting
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanup();
  }

  /**
   * Check if request is within rate limit
   * @param {string} key - Unique identifier (IP, user ID, etc.)
   * @param {number} windowMs - Time window in milliseconds
   * @param {number} maxRequests - Maximum requests per window
   * @returns {Object} Rate limit status
   */
  isAllowed(key, windowMs, maxRequests) {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const userRequests = this.requests.get(key);

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      (timestamp) => timestamp > windowStart
    );
    this.requests.set(key, validRequests);

    // Check if within limit
    if (validRequests.length >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.min(...validRequests) + windowMs,
      };
    }

    // Add current request
    validRequests.push(now);

    return {
      allowed: true,
      remaining: maxRequests - validRequests.length,
      resetTime: now + windowMs,
    };
  }

  /**
   * Cleanup old entries periodically
   */
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const [key, timestamps] of this.requests.entries()) {
        const validTimestamps = timestamps.filter(
          (timestamp) => now - timestamp < maxAge
        );

        if (validTimestamps.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, validTimestamps);
        }
      }
    }, 60000); // Cleanup every minute
  }
}

const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware factory
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 1000,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const { allowed, remaining, resetTime } = rateLimiter.isAllowed(
      key,
      windowMs,
      maxRequests
    );

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    });

    if (!allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
    }

    // Handle response-based rate limiting
    if (!skipSuccessfulRequests || !skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (data) {
        const shouldSkip =
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip) {
          // Remove this request from count
          const userRequests = rateLimiter.requests.get(key) || [];
          userRequests.pop(); // Remove the last (current) request
          rateLimiter.requests.set(key, userRequests);
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
};

// Predefined rate limiters
const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30, // 5 auth attempts per 15 minutes
  keyGenerator: (req) => `auth:${req.ip}`,
});

const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

const testRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 tests per minute
  keyGenerator: (req) => `test:${req.user?.id || req.ip}`,
});

module.exports = {
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  testRateLimit,
};
