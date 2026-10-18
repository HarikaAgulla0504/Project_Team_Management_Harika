import { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, forbidden, notFound } from '../lib/errors';
import { startOfTodayUtc } from '../lib/dates';
import { pageMeta } from '../lib/http';
import { AuthUser } from '../types';
import { logActivity } from './activity.service';
import { assertCanManage, assertMember, loadProjectAccess, visibleProjectsFilter } from './permissions.service';
import { TaskCreateInput, TaskListQuery, TaskUpdateInput } from '../validators/task';

// Related rows fetched in the SAME query via JOINs (avoids N+1).
const taskInclude = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, archivedAt: true } },
} satisfies Prisma.TaskInclude;

function assertDueDateNotPast(dueDate: Date) {
  if (dueDate < startOfTodayUtc()) {
    throw new AppError(400, 'Due date cannot be in the past', 'VALIDATION_ERROR', [
      { path: 'dueDate', message: 'Due date cannot be in the past' },
    ]);
  }
}

async function loadTaskWithAccess(user: AuthUser, taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw notFound('Task not found');
  // Permission to a task == permission to its project.
  const access = await loadProjectAccess(user, task.projectId, 'Task not found');
  return { task, access };
}

export async function listTasks(user: AuthUser, q: TaskListQuery) {
  const and: Prisma.TaskWhereInput[] = [{ project: visibleProjectsFilter(user) }];
  if (q.projectId) and.push({ projectId: q.projectId });
  if (q.assigneeId) and.push({ assigneeId: q.assigneeId === 'me' ? user.id : q.assigneeId });
  if (q.priority) and.push({ priority: q.priority });
  if (q.status) and.push({ status: q.status });
  if (q.search) and.push({ title: { contains: q.search, mode: 'insensitive' } });
  if (q.overdue) and.push({ dueDate: { lt: startOfTodayUtc() }, status: { not: TaskStatus.DONE } });
  const where: Prisma.TaskWhereInput = { AND: and };

  const orderBy = [{ [q.sortBy]: q.order }, { id: 'asc' }] as Prisma.TaskOrderByWithRelationInput[];

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.task.count({ where }),
  ]);
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

export async function getTask(user: AuthUser, id: number) {
  const { task, access } = await loadTaskWithAccess(user, id);
  const [comments, activity] = await Promise.all([
    prisma.taskComment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.activityLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    ...task,
    comments,
    activity,
    permissions: {
      canEdit: access.canManage,
      canChangeStatus: access.canManage || task.assigneeId === user.id,
      canDelete: access.canManage,
    },
  };
}

export async function createTask(user: AuthUser, input: TaskCreateInput) {
  const access = await loadProjectAccess(user, input.projectId);
  assertCanManage(access, 'Only admins and the project manager can create tasks');
  if (access.project.archivedAt) throw new AppError(409, 'This project is archived', 'PROJECT_ARCHIVED');
  assertDueDateNotPast(input.dueDate);

  let assigneeName: string | undefined;
  if (input.assigneeId) {
    assertMember(access, input.assigneeId);
    assigneeName = access.project.members.find((m) => m.userId === input.assigneeId)?.user.name;
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        projectId: input.projectId,
        assigneeId: input.assigneeId ?? null,
        createdById: user.id,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate,
      },
    });
    await logActivity(tx, {
      projectId: created.projectId,
      taskId: created.id,
      actorId: user.id,
      action: 'TASK_CREATED',
      details: { title: created.title },
    });
    if (input.assigneeId) {
      await logActivity(tx, {
        projectId: created.projectId,
        taskId: created.id,
        actorId: user.id,
        action: 'TASK_ASSIGNED',
        details: { toId: input.assigneeId, toName: assigneeName ?? '' },
      });
    }
    return created;
  });

  return getTask(user, task.id);
}

export async function updateTask(user: AuthUser, id: number, input: TaskUpdateInput) {
  const { task, access } = await loadTaskWithAccess(user, id);

  if (!access.canManage) {
    // Team members may ONLY change the status of tasks assigned to them.
    if (task.assigneeId !== user.id) throw forbidden('You can only update tasks assigned to you');
    const touched = Object.entries(input).filter(([, v]) => v !== undefined).map(([k]) => k);
    if (touched.some((k) => k !== 'status')) {
      throw forbidden('Team members can only change the status of their own tasks');
    }
  }

  const data: Prisma.TaskUncheckedUpdateInput = {};
  const changedFields: string[] = [];
  let statusChange: { from: TaskStatus; to: TaskStatus } | null = null;
  let assignChange: { fromId: number | null; toId: number | null; toName: string } | null = null;

  if (input.title !== undefined && input.title !== task.title) {
    data.title = input.title;
    changedFields.push('title');
  }
  if (input.description !== undefined && input.description !== task.description) {
    data.description = input.description;
    changedFields.push('description');
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    data.priority = input.priority;
    changedFields.push('priority');
  }
  if (input.dueDate !== undefined && input.dueDate.getTime() !== task.dueDate.getTime()) {
    assertDueDateNotPast(input.dueDate);
    data.dueDate = input.dueDate;
    changedFields.push('dueDate');
  }
  if (input.status !== undefined && input.status !== task.status) {
    data.status = input.status;
    statusChange = { from: task.status, to: input.status };
  }
  if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
    let toName = '';
    if (input.assigneeId !== null) {
      assertMember(access, input.assigneeId);
      toName = access.project.members.find((m) => m.userId === input.assigneeId)?.user.name ?? '';
    }
    data.assigneeId = input.assigneeId;
    assignChange = { fromId: task.assigneeId, toId: input.assigneeId, toName };
  }

  if (Object.keys(data).length === 0) return getTask(user, id);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data });
    const base = { projectId: task.projectId, taskId: id, actorId: user.id };
    if (changedFields.length) {
      await logActivity(tx, { ...base, action: 'TASK_UPDATED', details: { fields: changedFields } });
    }
    if (statusChange) {
      await logActivity(tx, { ...base, action: 'TASK_STATUS_CHANGED', details: statusChange });
    }
    if (assignChange) {
      await logActivity(tx, { ...base, action: 'TASK_ASSIGNED', details: assignChange });
    }
  });

  return getTask(user, id);
}

export async function deleteTask(user: AuthUser, id: number) {
  const { task, access } = await loadTaskWithAccess(user, id);
  assertCanManage(access, 'Only admins and the project manager can delete tasks');

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    // taskId is omitted on purpose: the task no longer exists, but we keep the history line.
    await logActivity(tx, {
      projectId: task.projectId,
      actorId: user.id,
      action: 'TASK_DELETED',
      details: { title: task.title },
    });
  });
}

export async function addComment(user: AuthUser, taskId: number, body: string) {
  // Anyone who can see the task (admin, project manager, project member) may comment.
  const { task } = await loadTaskWithAccess(user, taskId);

  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: { taskId, authorId: user.id, body },
      include: { author: { select: { id: true, name: true } } },
    });
    await logActivity(tx, {
      projectId: task.projectId,
      taskId,
      actorId: user.id,
      action: 'COMMENT_ADDED',
      details: { title: task.title },
    });
    return comment;
  });
}
