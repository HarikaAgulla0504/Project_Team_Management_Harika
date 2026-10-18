import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, ProjectStatus, Role, TaskPriority, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();
const day = 24 * 60 * 60 * 1000;
const dateFromNow = (days: number) => {
  const d = new Date(Date.now() + days * day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function upsertUser(name: string, email: string, password: string, role: Role) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role },
  });
}

async function main() {
  // 1) The initial admin account (credentials come from .env).
  const admin = await upsertUser(
    process.env.SEED_ADMIN_NAME ?? 'System Admin',
    (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase(),
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
    Role.ADMIN,
  );
  console.log(`Admin ready: ${admin.email}`);

  // 2) Demo data (skipped if projects already exist so the seed is safe to re-run).
  if ((await prisma.project.count()) > 0) {
    console.log('Projects already exist - skipping demo data.');
    return;
  }

  const demoPassword = 'Demo@12345';
  const manager = await upsertUser('Priya Manager', 'manager@example.com', demoPassword, Role.PROJECT_MANAGER);
  const alice = await upsertUser('Alice Member', 'alice@example.com', demoPassword, Role.TEAM_MEMBER);
  const bob = await upsertUser('Bob Member', 'bob@example.com', demoPassword, Role.TEAM_MEMBER);

  const website = await prisma.project.create({
    data: {
      name: 'Website Redesign',
      description: 'Refresh the marketing website with a new look and faster pages.',
      startDate: dateFromNow(-14),
      deadline: dateFromNow(30),
      status: ProjectStatus.ACTIVE,
      ownerId: manager.id,
      members: { create: [{ userId: manager.id }, { userId: alice.id }, { userId: bob.id }] },
    },
  });
  const mobile = await prisma.project.create({
    data: {
      name: 'Mobile App MVP',
      description: 'First release of the customer mobile app.',
      startDate: dateFromNow(-3),
      deadline: dateFromNow(60),
      status: ProjectStatus.PLANNING,
      ownerId: manager.id,
      members: { create: [{ userId: manager.id }, { userId: alice.id }] },
    },
  });

  const tasks = [
    { p: website, title: 'Design new homepage', who: alice, pr: TaskPriority.HIGH, st: TaskStatus.DONE, due: -5 },
    { p: website, title: 'Implement responsive navigation', who: bob, pr: TaskPriority.MEDIUM, st: TaskStatus.IN_PROGRESS, due: 7 },
    { p: website, title: 'Optimise image loading', who: alice, pr: TaskPriority.LOW, st: TaskStatus.TODO, due: 14 },
    { p: website, title: 'Fix broken contact form', who: bob, pr: TaskPriority.CRITICAL, st: TaskStatus.IN_REVIEW, due: -2 },
    { p: website, title: 'Write launch announcement', who: alice, pr: TaskPriority.MEDIUM, st: TaskStatus.TODO, due: 25 },
    { p: mobile, title: 'Define MVP feature list', who: alice, pr: TaskPriority.HIGH, st: TaskStatus.IN_PROGRESS, due: 5 },
    { p: mobile, title: 'Set up CI pipeline', who: manager, pr: TaskPriority.MEDIUM, st: TaskStatus.TODO, due: 20 },
    { p: mobile, title: 'Create wireframes', who: alice, pr: TaskPriority.HIGH, st: TaskStatus.TODO, due: 10 },
  ];

  for (const t of tasks) {
    const created = await prisma.task.create({
      data: {
        title: t.title,
        description: `Demo task: ${t.title}.`,
        projectId: t.p.id,
        assigneeId: t.who.id,
        createdById: manager.id,
        priority: t.pr,
        status: t.st,
        dueDate: dateFromNow(t.due),
      },
    });
    await prisma.activityLog.create({
      data: { projectId: t.p.id, taskId: created.id, actorId: manager.id, action: 'TASK_CREATED', details: { title: t.title } },
    });
  }

  console.log('Demo data created. Demo logins (password for all: Demo@12345):');
  console.log('  manager@example.com, alice@example.com, bob@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
