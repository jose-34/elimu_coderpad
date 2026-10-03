const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// The API integration suite drives many requests from one IP; the limits
// themselves are express-rate-limit's concern, not ours to re-test.
const skip = () => env.nodeEnv === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many attempts, please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests, please slow down.' },
});

// The public join endpoint is the only unauthenticated lookup by secret, so
// throttle it hard to make guessing session codes impractical.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many attempts, please try again later.' },
});

module.exports = { authLimiter, apiLimiter, joinLimiter };
