import { TaskPriority, TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { dateInput, idSchema, paginationSchema } from './common';

export const taskListQuery = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  // "me" is a convenience for "tasks assigned to the logged-in user"
  assigneeId: z.union([z.literal('me'), z.coerce.number().int().positive()]).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  overdue: z.enum(['true']).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...paginationSchema,
});

export const taskCreateSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(5000).default(''),
  assigneeId: idSchema.nullable().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  dueDate: dateInput,
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    assigneeId: idSchema.nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    dueDate: dateInput.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'At least one field is required');

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export type TaskListQuery = z.infer<typeof taskListQuery>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
