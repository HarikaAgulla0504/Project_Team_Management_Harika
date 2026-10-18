import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ProjectFormModal from '../components/ProjectFormModal';
import { Badge, EmptyState, ErrorBox, Loading, Pagination, ProgressBar } from '../components/ui';
import { formatDate, label } from '../format';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { PROJECT_STATUSES, ProjectSummary } from '../types';

export default function Projects() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');

  const status = params.get('status') ?? '';
  const archived = params.get('archived') === 'true';

  const { data, loading, error, reload } = useFetch(
    () => api.get<ProjectSummary[]>(`/projects${qs({ search: debounced, status, page, pageSize: 9, archived: archived ? 'true' : 'false' })}`),
    [debounced, status, page, archived],
  );

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  };

  return (
    <div>
      <div className="row-between">
        <h1>{archived ? 'Archived projects' : 'Projects'}</h1>
        {hasRole('ADMIN', 'PROJECT_MANAGER') && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New project</button>
        )}
      </div>

      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="filters">
        <input placeholder="Search projects…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={archived} onChange={(e) => setFilter('archived', e.target.checked ? 'true' : '')} />
          Show archived
        </label>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!loading && !error && data && (
        data.data.length === 0 ? (
          <EmptyState title="No projects found" hint="Try changing the filters, or create a new project." />
        ) : (
          <>
            <div className="cards">
              {data.data.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="card project-card plain-link">
                  <div className="row-between">
                    <h3>{p.name}</h3>
                    <Badge value={p.status} kind="status" />
                  </div>
                  <p className="muted clamp">{p.description || 'No description'}</p>
                  <ProgressBar percent={p.progress.percent} />
                  <div className="muted small">
                    {p._count.tasks} tasks · {p._count.members} members · due {formatDate(p.deadline)}
                  </div>
                  <div className="muted small">Owner: {p.owner.name}</div>
                </Link>
              ))}
            </div>
            {data.meta && <Pagination meta={data.meta} onPage={setPage} />}
          </>
        )
      )}

      {showForm && (
        <ProjectFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setNotice('Project created successfully.');
            reload();
          }}
        />
      )}
    </div>
  );
}
