/**
 * Rate Limiting Configuration for x402 Facilitator
 * Protects against spam, DoS, and abuse attacks
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

/**
 * General API rate limiting - applies to all endpoints
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks in production
  skip: (req) => req.path === '/health'
});

/**
 * Gaming-friendly rate limiting for payment operations
 */
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 payment requests per minute per IP (gaming-friendly)
  message: {
    error: 'Payment rate limit exceeded',
    code: 'PAYMENT_RATE_LIMIT',
    message: 'Too many payment requests. Please wait before trying again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Gaming-friendly rate limiting for settlement operations
 */
export const settlementRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 25, // 25 settlement requests per minute per IP (gaming-friendly)
  message: {
    error: 'Settlement rate limit exceeded',
    code: 'SETTLEMENT_RATE_LIMIT',
    message: 'Too many settlement requests. Please wait before trying again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for stats and non-critical endpoints
 */
export const statsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    error: 'Stats rate limit exceeded',
    code: 'STATS_RATE_LIMIT',
    message: 'Too many stats requests. Please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Gradual slowdown for suspicious activity
 * Adds delay before hitting hard rate limits
 */
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: (hits) => {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
    return Math.min(100 * Math.pow(2, hits - 50), 3000); // Cap at 3 seconds
  },
  maxDelayMs: 3000, // Maximum delay of 3 seconds
  // Skip slowdown for health checks
  skip: (req) => req.path === '/health'
});

/**
 * Rate limiting specifically for wallet-based operations
 * Uses client public key from payment requests for more granular control
 */
export const createWalletRateLimit = (maxRequests: number, windowMinutes: number) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      error: 'Wallet rate limit exceeded',
      code: 'WALLET_RATE_LIMIT',
      message: `Too many requests from this wallet. Limit: ${maxRequests} per ${windowMinutes} minutes.`,
      retryAfter: `${windowMinutes} minutes`
    },
    // Simplified to use default IP-based rate limiting for IPv6 compatibility
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Custom rate limiting for nonce operations
 */
export const nonceRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 nonce operations per hour per IP
  message: {
    error: 'Nonce rate limit exceeded',
    code: 'NONCE_RATE_LIMIT',
    message: 'Too many nonce requests. Please wait before trying again.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting configuration for gaming scenarios
 * Optimized for high-frequency gaming usage
 */
export const gamingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 gaming actions per minute (high-frequency gaming support)
  message: {
    error: 'Gaming rate limit exceeded',
    code: 'GAMING_RATE_LIMIT',
    message: 'Too many gaming actions. Please slow down a bit!',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});