import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Icon, { IconName } from '../components/Icon';
import { Badge, EmptyState, ErrorBox, Loading, ProgressBar } from '../components/ui';
import { formatDate, isOverdue, label } from '../format';
import { useFetch } from '../hooks/useFetch';
import { DashboardSummary, TASK_STATUSES } from '../types';

function Stat({ title, value, to, icon, tone }: { title: string; value: number; to: string; icon: IconName; tone: string }) {
  return (
    <Link to={to} className={`card stat tone-${tone} plain-link`}>
      <span className="stat-icon"><Icon name={icon} size={22} /></span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get<DashboardSummary>('/dashboard/summary'));

  if (loading) return <Loading text="Loading dashboard…" />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load dashboard'} onRetry={reload} />;
  const s = data.data;
  const maxStatus = Math.max(1, ...Object.values(s.tasksByStatus));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Welcome back, {user?.name.split(' ')[0]} 👋</h1>
          <p className="muted">Here is what is happening across your projects.</p>
        </div>
      </div>

      <div className="stats">
        <Stat title="Total projects" value={s.totalProjects} to="/projects" icon="folder" tone="indigo" />
        <Stat title="Active projects" value={s.activeProjects} to="/projects?status=ACTIVE" icon="play" tone="blue" />
        <Stat title="Completed projects" value={s.completedProjects} to="/projects?status=COMPLETED" icon="check" tone="green" />
        <Stat title="Total tasks" value={s.totalTasks} to="/tasks" icon="tasks" tone="violet" />
        <Stat title="Overdue tasks" value={s.overdueTasks} to="/tasks?overdue=true" icon="alert" tone="red" />
        <Stat title="My open tasks" value={s.myOpenTasks} to="/tasks?assigneeId=me" icon="user" tone="amber" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2><Icon name="activity" /> Tasks by status</h2>
          {s.totalTasks === 0 ? (
            <EmptyState title="No tasks yet" />
          ) : (
            TASK_STATUSES.map((st) => (
              <div key={st} className="bar-row">
                <span className="bar-label">{label(st)}</span>
                <div className="bar-track">
                  <div className={`bar-fill bar-${st.toLowerCase()}`} style={{ width: `${(s.tasksByStatus[st] / maxStatus) * 100}%` }} />
                </div>
                <span className="bar-count">{s.tasksByStatus[st]}</span>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h2><Icon name="user" /> My upcoming tasks</h2>
          {s.myTasks.length === 0 ? (
            <EmptyState title="Nothing assigned to you" hint="Tasks assigned to you will show up here." />
          ) : (
            <ul className="list">
              {s.myTasks.map((t) => (
                <li key={t.id}>
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                  <div className="muted small meta-line">
                    {t.project.name} <Badge value={t.status} kind="status" />
                    <span className={isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}>
                      <Icon name="calendar" size={13} /> {formatDate(t.dueDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2><Icon name="folder" /> Project completion</h2>
        {s.projectProgress.length === 0 ? (
          <EmptyState title="No projects yet" hint="Projects you belong to will appear here." />
        ) : (
          <ul className="list">
            {s.projectProgress.map((p) => (
              <li key={p.id}>
                <div className="row-between">
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  <span className="muted small">{p.done}/{p.total} tasks done · deadline {formatDate(p.deadline)}</span>
                </div>
                <ProgressBar percent={p.percent} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
