import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Rate limiter for message endpoints via token (no auth)
export const tokenMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests max
  message: 'Trop de tentatives, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for sending messages (authenticated)
export const sendMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per user
  message: 'Vous envoyez trop de messages, veuillez attendre',
  keyGenerator: (req) => (req as any).user?._id?.toString() || ipKeyGenerator(req),
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for getting thread by token
export const getThreadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for marking messages as read via token
export const markReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per IP
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for reactions via token
export const reactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // 25 requests per IP
  message: 'Trop de réactions, veuillez attendre',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for creating requests (public - no auth)
export const createRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP per hour
  message: 'Trop de demandes de service, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for token-based request actions (confirm, resend)
export const requestTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP
  message: 'Trop de tentatives, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for provider actions (accept, propose, refuse)
export const providerActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per user
  message: 'Trop d\'actions, veuillez attendre',
  keyGenerator: (req) => (req as any).user?._id?.toString() || ipKeyGenerator(req),
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for client actions (accept proposal, archive, etc.)
export const clientActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per user
  message: 'Trop d\'actions, veuillez attendre',
  keyGenerator: (req) => (req as any).user?._id?.toString() || ipKeyGenerator(req),
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for login attempts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for registration
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per IP
  message: 'Trop de tentatives d\'inscription, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for forgot password
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per IP
  message: 'Trop de tentatives, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Rate limiter for reset password
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per IP
  message: 'Trop de tentatives, veuillez réessayer plus tard',
  keyGenerator: ipKeyGenerator,
  skip: (req) => process.env.NODE_ENV === 'test',
});
