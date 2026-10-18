import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError, unauthorized } from './errors';
import { AuthUser } from '../types';

// Express 4 does not catch rejected promises from async handlers; this wrapper does.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parseId(value: string | undefined, label = 'id'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, `Invalid ${label}`, 'VALIDATION_ERROR');
  }
  return n;
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export const pageMeta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
