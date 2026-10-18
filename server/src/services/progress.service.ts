import { TaskStatus } from '@prisma/client';

export interface Progress {
  total: number;
  done: number;
  percent: number;
  byStatus: Record<TaskStatus, number>;
}

type Group = { projectId?: number; status: TaskStatus; _count: { _all: number } };

const emptyByStatus = (): Record<TaskStatus, number> => ({
  TODO: 0,
  IN_PROGRESS: 0,
  IN_REVIEW: 0,
  DONE: 0,
});

// Turns the rows of ONE `groupBy` query into per-project progress numbers,
// so we never need one query per project (avoids the N+1 problem).
export function buildProgressMap(groups: Group[]): Map<number, Progress> {
  const map = new Map<number, Progress>();
  for (const g of groups) {
    if (g.projectId === undefined) continue;
    const p = map.get(g.projectId) ?? { total: 0, done: 0, percent: 0, byStatus: emptyByStatus() };
    p.byStatus[g.status] += g._count._all;
    p.total += g._count._all;
    if (g.status === TaskStatus.DONE) p.done += g._count._all;
    p.percent = Math.round((p.done / p.total) * 100);
    map.set(g.projectId, p);
  }
  return map;
}

export const emptyProgress = (): Progress => ({ total: 0, done: 0, percent: 0, byStatus: emptyByStatus() });
