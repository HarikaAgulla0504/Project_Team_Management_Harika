import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();
export const PASSWORD = 'Passw0rd123';

export async function resetDb() {
  // Order matters because of foreign keys (children first).
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.taskComment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function createUser(role: Role, email: string, name = email.split('@')[0]) {
  return prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
}

// Logs in and returns the cookie so later requests are authenticated.
export async function login(email: string): Promise<string[]> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.get('Set-Cookie') as string[];
}

export const as = (cookie: string[]) => ({
  get: (url: string) => request(app).get(url).set('Cookie', cookie),
  post: (url: string, body?: object) => request(app).post(url).set('Cookie', cookie).send(body),
  patch: (url: string, body?: object) => request(app).patch(url).set('Cookie', cookie).send(body),
  del: (url: string) => request(app).delete(url).set('Cookie', cookie),
});

export const futureDate = (days = 7) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// Builds the common scenario: admin, manager (owner), member A (in project), member B (NOT in project).
export async function scenario() {
  const admin = await createUser(Role.ADMIN, 'admin@test.com');
  const manager = await createUser(Role.PROJECT_MANAGER, 'manager@test.com');
  const otherManager = await createUser(Role.PROJECT_MANAGER, 'manager2@test.com');
  const alice = await createUser(Role.TEAM_MEMBER, 'alice@test.com');
  const bob = await createUser(Role.TEAM_MEMBER, 'bob@test.com');

  const managerApi = as(await login('manager@test.com'));
  const project = (
    await managerApi.post('/api/projects', {
      name: 'Alpha project',
      startDate: futureDate(0),
      deadline: futureDate(30),
      memberIds: [alice.id],
    })
  ).body.data;

  return { admin, manager, otherManager, alice, bob, project, managerApi };
}
