import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { as, futureDate, login, resetDb, scenario } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('projects', () => {
  it('lets a project manager create a project and become its owner + member', async () => {
    const { project, manager } = await scenario();
    expect(project.name).toBe('Alpha project');
    expect(project.ownerId).toBe(manager.id);
    expect(project.members.map((m: { id: number }) => m.id)).toContain(manager.id);
    expect(project.permissions.canManage).toBe(true);
  });

  it('validates required fields and the deadline rule', async () => {
    await scenario();
    const api = as(await login('manager@test.com'));

    const missing = await api.post('/api/projects', { description: 'no name or dates' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['name', 'startDate', 'deadline']),
    );

    const badDates = await api.post('/api/projects', { name: 'Bad dates', startDate: futureDate(10), deadline: futureDate(1) });
    expect(badDates.status).toBe(400);
  });

  it('forbids team members from creating projects (backend enforcement)', async () => {
    await scenario();
    const res = await as(await login('alice@test.com')).post('/api/projects', {
      name: 'Sneaky project',
      startDate: futureDate(0),
      deadline: futureDate(5),
    });
    expect(res.status).toBe(403);
  });

  it('hides a project from users who are not members (404) and from their lists', async () => {
    const { project } = await scenario();
    const bob = as(await login('bob@test.com'));
    expect((await bob.get(`/api/projects/${project.id}`)).status).toBe(404);
    const list = await bob.get('/api/projects');
    expect(list.body.data).toHaveLength(0);

    const alice = as(await login('alice@test.com'));
    expect((await alice.get(`/api/projects/${project.id}`)).status).toBe(200);
    expect((await alice.get('/api/projects')).body.data).toHaveLength(1);
  });

  it('only lets the owning manager (or an admin) edit; other managers get 404, members 403', async () => {
    const { project } = await scenario();
    const patch = { status: 'ACTIVE' };

    const otherMgr = as(await login('manager2@test.com'));
    expect((await otherMgr.patch(`/api/projects/${project.id}`, patch)).status).toBe(404);

    const alice = as(await login('alice@test.com'));
    expect((await alice.patch(`/api/projects/${project.id}`, patch)).status).toBe(403);

    const owner = as(await login('manager@test.com'));
    const ok = await owner.patch(`/api/projects/${project.id}`, patch);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('ACTIVE');

    const admin = as(await login('admin@test.com'));
    expect((await admin.patch(`/api/projects/${project.id}`, { name: 'Renamed by admin' })).status).toBe(200);
  });

  it('records activity history for project changes', async () => {
    const { project, managerApi } = await scenario();
    await managerApi.patch(`/api/projects/${project.id}`, { status: 'ACTIVE' });
    const res = await managerApi.get(`/api/projects/${project.id}`);
    const actions = res.body.data.activity.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['PROJECT_CREATED', 'PROJECT_STATUS_CHANGED']));
  });

  it('archives (manager) but only admins can permanently delete', async () => {
    const { project, managerApi } = await scenario();
    expect((await managerApi.post(`/api/projects/${project.id}/archive`)).status).toBe(200);
    expect((await managerApi.get('/api/projects')).body.data).toHaveLength(0);
    expect((await managerApi.get('/api/projects?archived=true')).body.data).toHaveLength(1);

    expect((await managerApi.del(`/api/projects/${project.id}`)).status).toBe(403);
    const admin = as(await login('admin@test.com'));
    expect((await admin.del(`/api/projects/${project.id}`)).status).toBe(204);
  });

  it('paginates the project list in the database', async () => {
    const { managerApi } = await scenario(); // already 1 project
    for (let i = 0; i < 4; i++) {
      await managerApi.post('/api/projects', { name: `Extra project ${i}`, startDate: futureDate(0), deadline: futureDate(10 + i) });
    }
    const page1 = await managerApi.get('/api/projects?page=1&pageSize=2');
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    const page3 = await managerApi.get('/api/projects?page=3&pageSize=2');
    expect(page3.body.data).toHaveLength(1);
  });
});
