import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { as, futureDate, login, resetDb, scenario } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function makeTask(
  managerApi: ReturnType<typeof as>,
  projectId: number,
  extra: Record<string, unknown> = {},
) {
  const res = await managerApi.post('/api/tasks', {
    projectId,
    title: 'Write the specification',
    dueDate: futureDate(5),
    ...extra,
  });
  return res;
}

describe('tasks', () => {
  it('creates a task with defaults and logs the creation', async () => {
    const { project, managerApi, alice } = await scenario();
    const res = await makeTask(managerApi, project.id, { assigneeId: alice.id, priority: 'HIGH' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'TODO', priority: 'HIGH', assigneeId: alice.id });
    const actions = res.body.data.activity.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['TASK_CREATED', 'TASK_ASSIGNED']));
  });

  it('validates required fields, past due dates and assignee membership', async () => {
    const { project, managerApi, bob } = await scenario();

    const missing = await managerApi.post('/api/tasks', { projectId: project.id });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['title', 'dueDate']),
    );

    const past = await makeTask(managerApi, project.id, { dueDate: '2020-01-01' });
    expect(past.status).toBe(400);

    const badDate = await makeTask(managerApi, project.id, { dueDate: 'not-a-date' });
    expect(badDate.status).toBe(400);

    // bob exists but is not a member of this project
    const notMember = await makeTask(managerApi, project.id, { assigneeId: bob.id });
    expect(notMember.status).toBe(400);
    expect(notMember.body.error.code).toBe('INVALID_ASSIGNEE');
  });

  it('lets the assignee update ONLY the status and records it in the history', async () => {
    const { project, managerApi, alice } = await scenario();
    const task = (await makeTask(managerApi, project.id, { assigneeId: alice.id })).body.data;
    const aliceApi = as(await login('alice@test.com'));

    const ok = await aliceApi.patch(`/api/tasks/${task.id}`, { status: 'IN_PROGRESS' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('IN_PROGRESS');
    expect(ok.body.data.activity.map((a: { action: string }) => a.action)).toContain('TASK_STATUS_CHANGED');

    const tooMuch = await aliceApi.patch(`/api/tasks/${task.id}`, { status: 'DONE', priority: 'LOW' });
    expect(tooMuch.status).toBe(403);
    const reassign = await aliceApi.patch(`/api/tasks/${task.id}`, { assigneeId: null });
    expect(reassign.status).toBe(403);
  });

  it('does not let a member update a task assigned to someone else', async () => {
    const { project, managerApi, alice, manager } = await scenario();
    const task = (await makeTask(managerApi, project.id, { assigneeId: manager.id })).body.data;
    const res = await as(await login('alice@test.com')).patch(`/api/tasks/${task.id}`, { status: 'DONE' });
    expect(res.status).toBe(403);
    expect(alice).toBeTruthy();
  });

  it('lets the manager reassign tasks and forbids members from creating or deleting tasks', async () => {
    const { project, managerApi, alice, manager } = await scenario();
    const task = (await makeTask(managerApi, project.id, { assigneeId: alice.id })).body.data;

    const re = await managerApi.patch(`/api/tasks/${task.id}`, { assigneeId: manager.id });
    expect(re.status).toBe(200);
    expect(re.body.data.assigneeId).toBe(manager.id);

    const aliceApi = as(await login('alice@test.com'));
    const create = await aliceApi.post('/api/tasks', { projectId: project.id, title: 'Member task', dueDate: futureDate(3) });
    expect(create.status).toBe(403);
    expect((await aliceApi.del(`/api/tasks/${task.id}`)).status).toBe(403);
    expect((await managerApi.del(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await managerApi.get(`/api/tasks/${task.id}`)).status).toBe(404);
  });

  it('blocks access to another project\'s tasks and comments (404) and excludes them from lists', async () => {
    const { project, managerApi, alice } = await scenario();
    const task = (await makeTask(managerApi, project.id, { assigneeId: alice.id })).body.data;

    const bob = as(await login('bob@test.com')); // not a member
    expect((await bob.get(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await bob.patch(`/api/tasks/${task.id}`, { status: 'DONE' })).status).toBe(404);
    expect((await bob.post(`/api/tasks/${task.id}/comments`, { body: 'hi' })).status).toBe(404);
    expect((await bob.get(`/api/tasks?projectId=${project.id}`)).body.data).toHaveLength(0);

    const otherMgr = as(await login('manager2@test.com'));
    expect((await otherMgr.get(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await otherMgr.del(`/api/tasks/${task.id}`)).status).toBe(404);
  });

  it('allows members of the project to comment, storing author and timestamp', async () => {
    const { project, managerApi, alice } = await scenario();
    const task = (await makeTask(managerApi, project.id, { assigneeId: alice.id })).body.data;
    const res = await as(await login('alice@test.com')).post(`/api/tasks/${task.id}/comments`, { body: 'On it!' });
    expect(res.status).toBe(201);
    expect(res.body.data.author.id).toBe(alice.id);
    expect(res.body.data.createdAt).toBeTruthy();

    const empty = await as(await login('alice@test.com')).post(`/api/tasks/${task.id}/comments`, { body: '   ' });
    expect(empty.status).toBe(400);

    const detail = await managerApi.get(`/api/tasks/${task.id}`);
    expect(detail.body.data.comments).toHaveLength(1);
  });
});

describe('task list: filtering, search, sorting, pagination', () => {
  async function seedTasks() {
    const ctx = await scenario();
    const { project, managerApi, alice, manager } = ctx;
    const defs = [
      { title: 'Alpha design', priority: 'LOW', assigneeId: alice.id, dueDate: futureDate(9) },
      { title: 'Beta build', priority: 'HIGH', assigneeId: alice.id, dueDate: futureDate(3) },
      { title: 'Gamma test', priority: 'CRITICAL', assigneeId: manager.id, dueDate: futureDate(6) },
      { title: 'Delta deploy', priority: 'MEDIUM', assigneeId: manager.id, dueDate: futureDate(12) },
      { title: 'Epsilon docs', priority: 'HIGH', assigneeId: alice.id, dueDate: futureDate(1) },
    ];
    for (const d of defs) await makeTask(managerApi, project.id, d);
    return ctx;
  }

  it('filters by priority, assignee and status', async () => {
    const { managerApi, alice } = await seedTasks();
    const high = await managerApi.get('/api/tasks?priority=HIGH');
    expect(high.body.data.map((t: { title: string }) => t.title).sort()).toEqual(['Beta build', 'Epsilon docs']);

    const byAssignee = await managerApi.get(`/api/tasks?assigneeId=${alice.id}`);
    expect(byAssignee.body.meta.total).toBe(3);

    const none = await managerApi.get('/api/tasks?status=DONE');
    expect(none.body.data).toHaveLength(0);
  });

  it('searches by title (case-insensitive) and "assigneeId=me" works', async () => {
    const { managerApi } = await seedTasks();
    const search = await managerApi.get('/api/tasks?search=gAmMa');
    expect(search.body.data).toHaveLength(1);

    const mine = await as(await login('alice@test.com')).get('/api/tasks?assigneeId=me');
    expect(mine.body.meta.total).toBe(3);
  });

  it('sorts and paginates in the database', async () => {
    const { managerApi } = await seedTasks();
    const page1 = await managerApi.get('/api/tasks?sortBy=dueDate&order=asc&page=1&pageSize=2');
    expect(page1.body.data.map((t: { title: string }) => t.title)).toEqual(['Epsilon docs', 'Beta build']);
    expect(page1.body.meta).toMatchObject({ total: 5, totalPages: 3, page: 1, pageSize: 2 });

    const page3 = await managerApi.get('/api/tasks?sortBy=dueDate&order=asc&page=3&pageSize=2');
    // order by dueDate asc: Epsilon, Beta, Gamma, Alpha, Delta -> page 3 holds the last one
    expect(page3.body.data.map((t: { title: string }) => t.title)).toEqual(['Delta deploy']);

    const byPriority = await managerApi.get('/api/tasks?sortBy=priority&order=desc&pageSize=1');
    expect(byPriority.body.data[0].priority).toBe('CRITICAL');
  });

  it('rejects invalid query parameters', async () => {
    const { managerApi } = await seedTasks();
    expect((await managerApi.get('/api/tasks?pageSize=1000')).status).toBe(400);
    expect((await managerApi.get('/api/tasks?priority=URGENT')).status).toBe(400);
    expect((await managerApi.get('/api/tasks?sortBy=passwordHash')).status).toBe(400);
  });
});

describe('dashboard', () => {
  it('computes metrics from real data and scopes them to the user', async () => {
    const { project, managerApi, alice } = await scenario();
    await makeTask(managerApi, project.id, { title: 'First task', assigneeId: alice.id });
    const t2 = (await makeTask(managerApi, project.id, { title: 'Second task', assigneeId: alice.id })).body.data;
    await as(await login('alice@test.com')).patch(`/api/tasks/${t2.id}`, { status: 'DONE' });

    const summary = (await managerApi.get('/api/dashboard/summary')).body.data;
    expect(summary.totalProjects).toBe(1);
    expect(summary.totalTasks).toBe(2);
    expect(summary.tasksByStatus).toMatchObject({ TODO: 1, DONE: 1 });
    expect(summary.projectProgress[0].percent).toBe(50);

    const aliceSummary = (await as(await login('alice@test.com')).get('/api/dashboard/summary')).body.data;
    expect(aliceSummary.myOpenTasks).toBe(1);

    const bobSummary = (await as(await login('bob@test.com')).get('/api/dashboard/summary')).body.data;
    expect(bobSummary.totalProjects).toBe(0);
    expect(bobSummary.totalTasks).toBe(0);
  });
});
