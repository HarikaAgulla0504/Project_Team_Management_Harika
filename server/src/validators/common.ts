import { z } from 'zod';

// Accepts "2026-10-17" or a full ISO string; rejects empty strings, null and impossible dates.
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Invalid date (use YYYY-MM-DD)')
  .pipe(z.coerce.date());

export const idSchema = z.number().int().positive();

export const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
};
