import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, EmptyState, ErrorBox, Loading, Pagination } from '../components/ui';
import { formatDate, isOverdue, label } from '../format';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { ProjectSummary, TASK_PRIORITIES, TASK_STATUSES, TaskSummary, User } from '../types';

export default function Tasks() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);

  // Filters live in the URL, so links from the dashboard (e.g. ?overdue=true) work and pages are shareable.
  const f = {
    projectId: params.get('projectId') ?? '',
    assigneeId: params.get('assigneeId') ?? '',
    priority: params.get('priority') ?? '',
    status: params.get('status') ?? '',
    overdue: params.get('overdue') ?? '',
    sortBy: params.get('sortBy') ?? 'dueDate',
    order: params.get('order') ?? 'asc',
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  };

  const projects = useFetch(() => api.get<ProjectSummary[]>('/projects?pageSize=100'));
  const canListUsers = hasRole('ADMIN', 'PROJECT_MANAGER');
  const users = useFetch(() => (canListUsers ? api.get<User[]>('/users?pageSize=100') : Promise.resolve({ data: [] as User[] })), [canListUsers]);

  const { data, loading, error, reload } = useFetch(
    () => api.get<TaskSummary[]>(`/tasks${qs({ ...f, search: debounced, page, pageSize: 10 })}`),
    [debounced, page, f.projectId, f.assigneeId, f.priority, f.status, f.overdue, f.sortBy, f.order],
  );

  return (
    <div>
      <h1>Tasks</h1>

      <div className="filters">
        <input placeholder="Search by title…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={f.projectId} onChange={(e) => setFilter('projectId', e.target.value)}>
          <option value="">All projects</option>
          {projects.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={f.assigneeId} onChange={(e) => setFilter('assigneeId', e.target.value)}>
          <option value="">Any assignee</option>
          <option value="me">Assigned to me</option>
          {users.data?.data.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={f.priority} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select value={f.sortBy} onChange={(e) => setFilter('sortBy', e.target.value)}>
          <option value="dueDate">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="status">Sort: Status</option>
          <option value="title">Sort: Title</option>
          <option value="createdAt">Sort: Created</option>
        </select>
        <select value={f.order} onChange={(e) => setFilter('order', e.target.value)}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={f.overdue === 'true'} onChange={(e) => setFilter('overdue', e.target.checked ? 'true' : '')} />
          Overdue only
        </label>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!loading && !error && data && (data.data.length === 0 ? (
        <EmptyState title="No tasks match your filters" hint="Clear a filter or open a project to create tasks." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Project</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {data.data.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                    <td><Link to={`/projects/${t.project.id}`}>{t.project.name}</Link></td>
                    <td>{t.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
                    <td><Badge value={t.priority} kind="priority" /></td>
                    <td><Badge value={t.status} kind="status" /></td>
                    <td className={isOverdue(t.dueDate, t.status) ? 'text-danger' : ''}>{formatDate(t.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta && <Pagination meta={data.meta} onPage={setPage} />}
        </>
      ))}
    </div>
  );
}
