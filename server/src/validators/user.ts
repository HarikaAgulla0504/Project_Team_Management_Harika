import { Role } from '@prisma/client';
import { z } from 'zod';
import { passwordSchema } from './auth';
import { paginationSchema } from './common';

export const userListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  ...paginationSchema,
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: passwordSchema,
  role: z.nativeEnum(Role).default(Role.TEAM_MEMBER),
});

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'At least one field is required');

export type UserListQuery = z.infer<typeof userListQuery>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
