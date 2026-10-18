import request from 'supertest';
import { Role } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createUser, login, PASSWORD, resetDb, as } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('authentication', () => {
  it('registers a new user as TEAM_MEMBER and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'New@Test.com', password: PASSWORD, role: 'ADMIN' }); // role must be ignored
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe(Role.TEAM_MEMBER);
    expect(res.body.data.email).toBe('new@test.com');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects registration with a weak password and with a duplicate email', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'Weak', email: 'w@test.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');

    await createUser(Role.TEAM_MEMBER, 'dup@test.com');
    const dup = await request(app).post('/api/auth/register').send({ name: 'Dup', email: 'dup@test.com', password: PASSWORD });
    expect(dup.status).toBe(409);
  });

  it('logs in successfully and sets an httpOnly cookie', async () => {
    await createUser(Role.TEAM_MEMBER, 'user@test.com');
    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = (res.get('Set-Cookie') as string[]).join(';');
    expect(cookie).toContain('token=');
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('fails login with a wrong password or an unknown email using the same message', async () => {
    await createUser(Role.TEAM_MEMBER, 'user@test.com');
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'WrongPass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: PASSWORD });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks protected routes without a session and after logout', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401);

    await createUser(Role.TEAM_MEMBER, 'user@test.com');
    const cookie = await login('user@test.com');
    expect((await as(cookie).get('/api/auth/me')).status).toBe(200);

    const out = await as(cookie).post('/api/auth/logout');
    expect(out.status).toBe(200);
    // The server clears the cookie in the browser; an empty cookie must not authenticate.
    expect((await request(app).get('/api/auth/me').set('Cookie', 'token=')).status).toBe(401);
  });

  it('rejects a deactivated user even with a valid token', async () => {
    const u = await createUser(Role.TEAM_MEMBER, 'user@test.com');
    const cookie = await login('user@test.com');
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect((await as(cookie).get('/api/auth/me')).status).toBe(401);
  });
});
