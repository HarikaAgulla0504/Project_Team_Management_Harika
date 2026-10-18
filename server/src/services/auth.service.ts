import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError, unauthorized } from '../lib/errors';
import { LoginInput, RegisterInput } from '../validators/auth';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// Used so a login for an unknown email takes about as long as one for a known email
// (prevents leaking which emails exist by measuring response time).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', env.BCRYPT_ROUNDS);

export const signToken = (userId: number) =>
  jwt.sign({}, env.JWT_SECRET, { subject: String(userId), expiresIn: env.JWT_EXPIRES_SECONDS });

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'This email is already registered', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  // Public sign-up ALWAYS creates a Team Member. Only an admin can grant higher roles.
  return prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: Role.TEAM_MEMBER },
    select: publicUserSelect,
  });
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Same message for "no such user" and "wrong password" on purpose.
  if (!user || !ok || !user.isActive) throw unauthorized('Invalid email or password');

  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
