import { Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { startOfTodayUtc } from '../lib/dates';
import { AuthUser } from '../types';
import { visibleProjectsFilter } from './permissions.service';
import { buildProgressMap, emptyProgress } from './progress.service';

// Everything here is computed from real rows, scoped to what THIS user may see.
export async function getSummary(user: AuthUser) {
  const projectWhere: Prisma.ProjectWhereInput = { archivedAt: null, ...visibleProjectsFilter(user) };
  const taskWhere: Prisma.TaskWhereInput = { project: projectWhere };
  const myOpen: Prisma.TaskWhereInput = {
    ...taskWhere,
    assigneeId: user.id,
    status: { not: TaskStatus.DONE },
  };

  const [projects, byStatusRows, overdueTasks, myOpenCount, myTasks, perProjectRows] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true, deadline: true },
      orderBy: { deadline: 'asc' },
    }),
    prisma.task.groupBy({ by: ['status'], where: taskWhere, _count: { _all: true } }),
    prisma.task.count({ where: { ...taskWhere, dueDate: { lt: startOfTodayUtc() }, status: { not: TaskStatus.DONE } } }),
    prisma.task.count({ where: myOpen }),
    prisma.task.findMany({
      where: myOpen,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.task.groupBy({ by: ['projectId', 'status'], where: taskWhere, _count: { _all: true } }),
  ]);

  const tasksByStatus: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  for (const row of byStatusRows) tasksByStatus[row.status] = row._count._all;
  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);

  const progress = buildProgressMap(perProjectRows);

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
    completedProjects: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
    totalTasks,
    tasksByStatus,
    overdueTasks,
    myOpenTasks: myOpenCount,
    myTasks,
    projectProgress: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      deadline: p.deadline,
      ...(progress.get(p.id) ?? emptyProgress()),
    })),
  };
}
