import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import ActivityList from '../components/ActivityList';
import TaskFormModal from '../components/TaskFormModal';
import { Badge, EmptyState, ErrorBox, Loading } from '../components/ui';
import { formatDate, formatDateTime, isOverdue, label } from '../format';
import { useFetch } from '../hooks/useFetch';
import { ProjectDetail, TASK_STATUSES, TaskDetail as TaskDetailType, TaskStatus } from '../types';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const task = useFetch(() => api.get<TaskDetailType>(`/tasks/${id}`), [id]);
  const projectId = task.data?.data.projectId;
  // Needed only for the edit form's "assignee" dropdown.
  const project = useFetch(
    () => (projectId && task.data?.data.permissions.canEdit ? api.get<ProjectDetail>(`/projects/${projectId}`) : Promise.resolve(null)),
    [projectId, task.data?.data.permissions.canEdit],
  );

  if (task.loading && !task.data) return <Loading />;
  if (task.error || !task.data) return <ErrorBox message={task.error ?? 'Task not found'} onRetry={task.reload} />;
  const t = task.data.data;

  async function changeStatus(status: TaskStatus) {
    setActionError('');
    try {
      await api.patch(`/tasks/${t.id}`, { status });
      setNotice('Status updated.');
      task.reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not update status');
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    setActionError('');
    try {
      await api.post(`/tasks/${t.id}/comments`, { body: comment });
      setComment('');
      task.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add comment');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.del(`/tasks/${t.id}`);
      navigate(`/projects/${t.projectId}`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Delete failed');
    }
  }

  return (
    <div>
      <p><Link to={`/projects/${t.project.id}`}>← {t.project.name}</Link></p>
      <div className="row-between">
        <h1>{t.title}</h1>
        <div className="actions">
          {t.permissions.canEdit && <button className="btn" onClick={() => setEditing(true)}>Edit</button>}
          {t.permissions.canDelete && <button className="btn btn-danger" onClick={remove}>Delete</button>}
        </div>
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <section className="card">
        <p>{t.description || <span className="muted">No description</span>}</p>
        <dl className="details">
          <dt>Status</dt>
          <dd>
            {t.permissions.canChangeStatus ? (
              <select value={t.status} onChange={(e) => changeStatus(e.target.value as TaskStatus)}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            ) : (
              <Badge value={t.status} kind="status" />
            )}
          </dd>
          <dt>Priority</dt><dd><Badge value={t.priority} kind="priority" /></dd>
          <dt>Assignee</dt><dd>{t.assignee?.name ?? 'Unassigned'}</dd>
          <dt>Due date</dt>
          <dd className={isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}>
            {formatDate(t.dueDate)} {isOverdue(t.dueDate, t.status) && '(overdue)'}
          </dd>
          <dt>Created</dt><dd>{formatDateTime(t.createdAt)} by {t.createdBy.name}</dd>
          <dt>Last updated</dt><dd>{formatDateTime(t.updatedAt)}</dd>
        </dl>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Comments ({t.comments.length})</h2>
          {t.comments.length === 0 ? (
            <EmptyState title="No comments yet" hint="Start the conversation below." />
          ) : (
            <ul className="comments">
              {t.comments.map((c) => (
                <li key={c.id}>
                  <strong>{c.author.name}</strong> <small className="muted">{formatDateTime(c.createdAt)}</small>
                  <p>{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addComment} className="form">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Write a comment…" maxLength={2000} />
            <button className="btn btn-primary" disabled={busy || !comment.trim()}>{busy ? 'Posting…' : 'Add comment'}</button>
          </form>
        </section>

        <section className="card">
          <h2>Activity history</h2>
          <ActivityList items={t.activity} />
        </section>
      </div>

      {editing && project.data?.data && (
        <TaskFormModal
          projectId={t.projectId}
          task={t}
          members={project.data.data.members}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setNotice('Task updated.'); task.reload(); }}
        />
      )}
    </div>
  );
}
