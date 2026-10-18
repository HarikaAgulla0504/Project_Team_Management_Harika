import { describeActivity, formatDateTime } from '../format';
import { Activity } from '../types';
import { EmptyState } from './ui';

export default function ActivityList({ items }: { items: Activity[] }) {
  if (items.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <ul className="activity">
      {items.map((a) => (
        <li key={a.id}>
          <strong>{a.actor.name}</strong> {describeActivity(a.action, a.details)}
          <small className="muted"> · {formatDateTime(a.createdAt)}</small>
        </li>
      ))}
    </ul>
  );
}
