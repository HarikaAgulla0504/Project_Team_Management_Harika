import { Prisma } from '@prisma/client';

// Works with both the normal prisma client and a transaction client (`tx`),
// so the log entry is written in the SAME transaction as the change it describes.
type Db = Pick<Prisma.TransactionClient, 'activityLog'>;

export type ActivityAction =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_STATUS_CHANGED'
  | 'PROJECT_ARCHIVED'
  | 'PROJECT_UNARCHIVED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED'
  | 'COMMENT_ADDED';

export async function logActivity(
  db: Db,
  entry: {
    projectId: number;
    taskId?: number | null;
    actorId: number;
    action: ActivityAction;
    details?: Prisma.InputJsonValue;
  },
) {
  await db.activityLog.create({
    data: {
      projectId: entry.projectId,
      taskId: entry.taskId ?? null,
      actorId: entry.actorId,
      action: entry.action,
      details: entry.details,
    },
  });
}
