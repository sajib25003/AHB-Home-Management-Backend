import { rateLimit } from 'express-rate-limit';

const rateLimitResponse = {
  success: false,
  message: 'Too many requests. Please try again later.',
};

export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitResponse,
});

export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many login attempts from this network. Please try again later.',
  },
});

export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email;

    return typeof email === 'string'
      ? `login:${email.trim().toLowerCase()}`
      : 'login:unknown';
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many failed attempts for this account. Please try again later.',
  },
});

export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitResponse,
});
