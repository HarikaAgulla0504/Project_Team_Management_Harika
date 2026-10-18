import { ProjectStatus } from '@prisma/client';
import { z } from 'zod';
import { dateInput, idSchema, paginationSchema } from './common';

export const projectListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  archived: z.enum(['true', 'false']).default('false'),
  ...paginationSchema,
});

export const projectCreateSchema = z
  .object({
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(120),
    description: z.string().trim().max(2000).default(''),
    startDate: dateInput,
    deadline: dateInput,
    status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
    memberIds: z.array(idSchema).max(100).default([]),
  })
  .refine((d) => d.deadline >= d.startDate, {
    message: 'Deadline must be on or after the start date',
    path: ['deadline'],
  });

export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    startDate: dateInput.optional(),
    deadline: dateInput.optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'At least one field is required');

export const addMemberSchema = z.object({ userId: idSchema });

export type ProjectListQuery = z.infer<typeof projectListQuery>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
