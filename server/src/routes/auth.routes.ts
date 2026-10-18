import { CookieOptions, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { asyncHandler, currentUser } from '../lib/http';
import { AUTH_COOKIE, authenticate } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth';

const router = Router();

// httpOnly  -> JavaScript in the browser cannot read the cookie (protects against XSS token theft)
// sameSite  -> browser will not attach it to cross-site requests (protects against CSRF)
// secure    -> HTTPS only in production
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: env.JWT_EXPIRES_SECONDS * 1000,
  path: '/',
};

const tooMany = { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' } };

// Brute-force protection: 10 FAILED logins per IP per 15 minutes (successful ones are not counted).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  skip: () => env.NODE_ENV === 'test',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  skip: () => env.NODE_ENV === 'test',
});

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const user = await authService.register(registerSchema.parse(req.body));
    res.cookie(AUTH_COOKIE, authService.signToken(user.id), cookieOptions);
    res.status(201).json({ data: user });
  }),
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const user = await authService.login(loginSchema.parse(req.body));
    res.cookie(AUTH_COOKIE, authService.signToken(user.id), cookieOptions);
    res.json({ data: user });
  }),
);

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ data: { loggedOut: true } });
});

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ data: currentUser(req) });
  }),
);

export default router;
