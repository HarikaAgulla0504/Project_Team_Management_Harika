import { useState } from 'react';
import Icon from '../components/Icon';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ActivityList from '../components/ActivityList';
import ProjectFormModal from '../components/ProjectFormModal';
import TaskFormModal from '../components/TaskFormModal';
import { Badge, EmptyState, ErrorBox, Loading, ProgressBar } from '../components/ui';
import { formatDate, isOverdue, label } from '../format';
import { useFetch } from '../hooks/useFetch';
import { ProjectDetail as ProjectDetailType, TaskSummary, User } from '../types';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [newMemberId, setNewMemberId] = useState('');

  const project = useFetch(() => api.get<ProjectDetailType>(`/projects/${id}`), [id]);
  const tasks = useFetch(() => api.get<TaskSummary[]>(`/tasks${qs({ projectId: id, pageSize: 100, sortBy: 'dueDate', order: 'asc' })}`), [id]);

  const canManage = project.data?.data.permissions.canManage ?? false;
  // The list of all users is only needed (and only allowed) when the user can manage the team.
  const users = useFetch(
    () => (canManage ? api.get<User[]>('/users?pageSize=100') : Promise.resolve({ data: [] as User[] })),
    [canManage],
  );

  if (project.loading) return <Loading />;
  if (project.error || !project.data) {
    return <ErrorBox message={project.error ?? 'Project not found'} onRetry={project.reload} />;
  }
  const p = project.data.data;

  async function run(action: () => Promise<unknown>, success: string) {
    setActionError('');
    try {
      await action();
      setNotice(success);
      project.reload();
      tasks.reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  }

  const memberIds = new Set(p.members.map((m) => m.id));
  const candidates = (users.data?.data ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <div>
      <p><Link to="/projects" className="back-link"><Icon name="back" size={16} /> All projects</Link></p>
      <div className="row-between">
        <h1>
          {p.name} <Badge value={p.status} kind="status" />
          {p.archivedAt && <span className="badge">Archived</span>}
        </h1>
        {canManage && (
          <div className="actions">
            <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit</button>
            {p.archivedAt ? (
              <button className="btn" onClick={() => run(() => api.post(`/projects/${p.id}/unarchive`), 'Project restored.')}><Icon name="restore" size={16} /> Restore</button>
            ) : (
              <button className="btn" onClick={() => run(() => api.post(`/projects/${p.id}/archive`), 'Project archived.')}><Icon name="archive" size={16} /> Archive</button>
            )}
            {hasRole('ADMIN') && (
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (!window.confirm('Permanently delete this project and ALL its tasks? This cannot be undone.')) return;
                  try {
                    await api.del(`/projects/${p.id}`);
                    navigate('/projects');
                  } catch (e) {
                    setActionError(e instanceof ApiError ? e.message : 'Delete failed');
                  }
                }}
              >
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <section className="card">
        <p>{p.description || <span className="muted">No description</span>}</p>
        <div className="muted">
          <Icon name="calendar" size={14} /> {formatDate(p.startDate)} → {formatDate(p.deadline)} · <Icon name="user" size={14} /> Owner: {p.owner.name}
        </div>
        <h3>Progress</h3>
        <ProgressBar percent={p.progress.percent} />
        <div className="muted small">
          {p.progress.done} of {p.progress.total} tasks done ·{' '}
          {Object.entries(p.progress.byStatus).map(([s, n]) => `${label(s)}: ${n}`).join(' · ')}
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2><Icon name="tasks" /> Tasks</h2>
          {canManage && !p.archivedAt && <button className="btn btn-primary" onClick={() => setAddingTask(true)}><Icon name="plus" size={16} /> New task</button>}
        </div>
        {tasks.loading && <Loading />}
        {tasks.error && <ErrorBox message={tasks.error} onRetry={tasks.reload} />}
        {tasks.data && (tasks.data.data.length === 0 ? (
          <EmptyState title="No tasks in this project yet" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {tasks.data.data.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                    <td>{t.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
                    <td><Badge value={t.priority} kind="priority" /></td>
                    <td><Badge value={t.status} kind="status" /></td>
                    <td className={isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}>{formatDate(t.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2><Icon name="users" /> Team ({p.members.length})</h2>
          <ul className="list">
            {p.members.map((m) => (
              <li key={m.id} className="row-between">
                <span>{m.name} <Badge value={m.role} kind="role" /></span>
                {canManage && m.id !== p.owner.id && (
                  <button className="btn btn-small" onClick={() => run(() => api.del(`/projects/${p.id}/members/${m.id}`), `${m.name} removed.`)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="inline-form">
              <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
                <option value="">Add a team member…</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <button
                className="btn btn-primary"
                disabled={!newMemberId}
                onClick={() => run(() => api.post(`/projects/${p.id}/members`, { userId: Number(newMemberId) }), 'Member added.').then(() => setNewMemberId(''))}
              >
                Add
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2><Icon name="activity" /> Recent activity</h2>
          <ActivityList items={p.activity} />
        </section>
      </div>

      {editing && (
        <ProjectFormModal project={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice('Project updated.'); project.reload(); }} />
      )}
      {addingTask && (
        <TaskFormModal projectId={p.id} members={p.members} onClose={() => setAddingTask(false)} onSaved={() => { setAddingTask(false); setNotice('Task created.'); project.reload(); tasks.reload(); }} />
      )}
    </div>
  );
}
