import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import { asyncHandler } from '../lib/http';

export const AUTH_COOKIE = 'token';

// 1) Reads the JWT from the httpOnly cookie (or an Authorization: Bearer header, handy for API tools).
// 2) Verifies the signature + expiry.
// 3) Re-loads the user from the DB so role changes / deactivation take effect immediately.
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[AUTH_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) throw unauthorized();

  let userId: number;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw unauthorized('Invalid or expired session');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw unauthorized('Account not found or deactivated');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
});

// Role guard used on routes: requireRole(Role.ADMIN, Role.PROJECT_MANAGER)
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
