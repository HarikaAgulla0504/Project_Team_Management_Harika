import { Prisma, ProjectStatus, Role, TaskStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, forbidden, notFound } from '../lib/errors';
import { pageMeta } from '../lib/http';
import { AuthUser } from '../types';
import { logActivity } from './activity.service';
import { assertCanManage, loadProjectAccess, visibleProjectsFilter } from './permissions.service';
import { buildProgressMap, emptyProgress } from './progress.service';
import { ProjectCreateInput, ProjectListQuery, ProjectUpdateInput } from '../validators/project';

async function assertActiveUsers(ids: number[]) {
  if (ids.length === 0) return;
  const count = await prisma.user.count({ where: { id: { in: ids }, isActive: true } });
  if (count !== ids.length) {
    throw new AppError(400, 'One or more selected users do not exist or are inactive', 'INVALID_MEMBERS');
  }
}

export async function listProjects(user: AuthUser, q: ProjectListQuery) {
  const where: Prisma.ProjectWhereInput = {
    ...visibleProjectsFilter(user),
    archivedAt: q.archived === 'true' ? { not: null } : null,
    ...(q.status ? { status: q.status } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
  };

  // Pagination happens in the database (skip/take), never in JS.
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ deadline: 'asc' }, { id: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true, tasks: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // ONE grouped query gives progress for every project on this page (no N+1).
  const groups = projects.length
    ? await prisma.task.groupBy({
        by: ['projectId', 'status'],
        where: { projectId: { in: projects.map((p) => p.id) } },
        _count: { _all: true },
      })
    : [];
  const progress = buildProgressMap(groups);

  const items = projects.map((p) => ({ ...p, progress: progress.get(p.id) ?? emptyProgress() }));
  return { items, meta: pageMeta(q.page, q.pageSize, total) };
}

export async function getProject(user: AuthUser, id: number) {
  const access = await loadProjectAccess(user, id);
  const { project } = access;

  const [groups, activity] = await Promise.all([
    prisma.task.groupBy({ by: ['projectId', 'status'], where: { projectId: id }, _count: { _all: true } }),
    prisma.activityLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { id: true, name: true } } },
    }),
  ]);

  const { members, ...rest } = project;
  return {
    ...rest,
    members: members.map((m) => m.user),
    progress: buildProgressMap(groups).get(id) ?? emptyProgress(),
    permissions: { canManage: access.canManage },
    activity,
  };
}

export async function createProject(user: AuthUser, input: ProjectCreateInput) {
  // The creator is always the owner and a member.
  const memberIds = Array.from(new Set([user.id, ...input.memberIds]));
  await assertActiveUsers(memberIds);

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        deadline: input.deadline,
        status: input.status,
        ownerId: user.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });
    await logActivity(tx, {
      projectId: created.id,
      actorId: user.id,
      action: 'PROJECT_CREATED',
      details: { name: created.name },
    });
    return created;
  });

  return getProject(user, project.id);
}

export async function updateProject(user: AuthUser, id: number, input: ProjectUpdateInput) {
  const access = await loadProjectAccess(user, id);
  assertCanManage(access);
  const { project } = access;

  // Validate the merged result (e.g. only the deadline changed, but it must still be >= start date).
  const startDate = input.startDate ?? project.startDate;
  const deadline = input.deadline ?? project.deadline;
  if (deadline < startDate) {
    throw new AppError(400, 'Deadline must be on or after the start date', 'VALIDATION_ERROR', [
      { path: 'deadline', message: 'Deadline must be on or after the start date' },
    ]);
  }

  const changed: string[] = [];
  if (input.name !== undefined && input.name !== project.name) changed.push('name');
  if (input.description !== undefined && input.description !== project.description) changed.push('description');
  if (input.startDate && input.startDate.getTime() !== project.startDate.getTime()) changed.push('startDate');
  if (input.deadline && input.deadline.getTime() !== project.deadline.getTime()) changed.push('deadline');
  const statusChanged = input.status !== undefined && input.status !== project.status;

  if (changed.length === 0 && !statusChanged) return getProject(user, id);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        deadline: input.deadline,
        status: input.status,
      },
    });
    if (changed.length) {
      await logActivity(tx, { projectId: id, actorId: user.id, action: 'PROJECT_UPDATED', details: { fields: changed } });
    }
    if (statusChanged) {
      await logActivity(tx, {
        projectId: id,
        actorId: user.id,
        action: 'PROJECT_STATUS_CHANGED',
        details: { from: project.status, to: input.status as ProjectStatus },
      });
    }
  });

  return getProject(user, id);
}

export async function addMember(user: AuthUser, projectId: number, userId: number) {
  const access = await loadProjectAccess(user, projectId);
  assertCanManage(access);
  await assertActiveUsers([userId]);

  if (access.project.members.some((m) => m.userId === userId)) {
    throw new AppError(409, 'User is already a member of this project', 'ALREADY_MEMBER');
  }
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.create({ data: { projectId, userId } });
    await logActivity(tx, {
      projectId,
      actorId: user.id,
      action: 'MEMBER_ADDED',
      details: { userId, name: target.name },
    });
  });
  return getProject(user, projectId);
}

export async function removeMember(user: AuthUser, projectId: number, userId: number) {
  const access = await loadProjectAccess(user, projectId);
  assertCanManage(access);

  const membership = access.project.members.find((m) => m.userId === userId);
  if (!membership) throw notFound('That user is not a member of this project');
  if (access.project.ownerId === userId) {
    throw new AppError(400, 'The project owner cannot be removed', 'INVALID_OPERATION');
  }

  await prisma.$transaction(async (tx) => {
    // Their open tasks in this project become unassigned.
    await tx.task.updateMany({
      where: { projectId, assigneeId: userId, status: { not: TaskStatus.DONE } },
      data: { assigneeId: null },
    });
    await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    await logActivity(tx, {
      projectId,
      actorId: user.id,
      action: 'MEMBER_REMOVED',
      details: { userId, name: membership.user.name },
    });
  });
  return getProject(user, projectId);
}

export async function setArchived(user: AuthUser, id: number, archived: boolean) {
  const access = await loadProjectAccess(user, id);
  assertCanManage(access);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logActivity(tx, {
      projectId: id,
      actorId: user.id,
      action: archived ? 'PROJECT_ARCHIVED' : 'PROJECT_UNARCHIVED',
    });
  });
  return getProject(user, id);
}

// Permanent delete is admin-only. Tasks, comments, members and logs are removed by ON DELETE CASCADE.
export async function deleteProject(user: AuthUser, id: number) {
  if (user.role !== Role.ADMIN) throw forbidden('Only admins can permanently delete projects');
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound('Project not found');
  await prisma.project.delete({ where: { id } });
}
