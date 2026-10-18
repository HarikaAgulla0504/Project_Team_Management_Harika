import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import { pageMeta } from '../lib/http';
import { AuthUser } from '../types';
import { publicUserSelect } from './auth.service';
import { UserCreateInput, UserListQuery, UserUpdateInput } from '../validators/user';

export async function listUsers(actor: AuthUser, q: UserListQuery) {
  const where: Prisma.UserWhereInput = {
    // Project managers only need active users (to add them to projects); admins see everyone.
    ...(actor.role === Role.ADMIN ? {} : { isActive: true }),
    ...(q.role ? { role: q.role } : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

export async function createUser(input: UserCreateInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'This email is already registered', 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  return prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: publicUserSelect,
  });
}

export async function updateUser(actor: AuthUser, id: number, input: UserUpdateInput) {
  // Guard rail: an admin cannot lock themselves out.
  if (actor.id === id && (input.role !== undefined && input.role !== Role.ADMIN)) {
    throw new AppError(400, 'You cannot remove your own admin role', 'INVALID_OPERATION');
  }
  if (actor.id === id && input.isActive === false) {
    throw new AppError(400, 'You cannot deactivate your own account', 'INVALID_OPERATION');
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('User not found');

  return prisma.user.update({
    where: { id },
    data: { name: input.name, role: input.role, isActive: input.isActive },
    select: publicUserSelect,
  });
}
