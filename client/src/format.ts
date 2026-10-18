// Dates from the API are UTC midnight, so format in UTC to avoid "off by one day" shifts.
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const toInputDate = (iso: string) => iso.slice(0, 10); // "2026-10-17T00:00:00.000Z" -> "2026-10-17"

export const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

export function isOverdue(dueDate: string, status: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return status !== 'DONE' && new Date(dueDate) < today;
}

export function describeActivity(action: string, d: Record<string, unknown> | null): string {
  const x = d ?? {};
  switch (action) {
    case 'PROJECT_CREATED': return `created the project "${x.name}"`;
    case 'PROJECT_UPDATED': return `updated the project (${(x.fields as string[] | undefined)?.join(', ')})`;
    case 'PROJECT_STATUS_CHANGED': return `changed project status from ${label(String(x.from))} to ${label(String(x.to))}`;
    case 'PROJECT_ARCHIVED': return 'archived the project';
    case 'PROJECT_UNARCHIVED': return 'restored the project from the archive';
    case 'MEMBER_ADDED': return `added ${x.name} to the team`;
    case 'MEMBER_REMOVED': return `removed ${x.name} from the team`;
    case 'TASK_CREATED': return `created the task "${x.title}"`;
    case 'TASK_UPDATED': return `edited the task (${(x.fields as string[] | undefined)?.join(', ')})`;
    case 'TASK_ASSIGNED': return x.toName ? `assigned the task to ${x.toName}` : 'unassigned the task';
    case 'TASK_STATUS_CHANGED': return `moved the task from ${label(String(x.from))} to ${label(String(x.to))}`;
    case 'TASK_DELETED': return `deleted the task "${x.title}"`;
    case 'COMMENT_ADDED': return 'added a comment';
    default: return action;
  }
}
