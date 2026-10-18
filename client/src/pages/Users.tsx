import { FormEvent, useState } from 'react';
import { api, ApiError, qs } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge, EmptyState, ErrorBox, Field, fieldErrors, Loading, Modal, Pagination } from '../components/ui';
import { formatDate, label } from '../format';
import { useDebounce } from '../hooks/useDebounce';
import { useFetch } from '../hooks/useFetch';
import { ROLES, Role, User } from '../types';

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEAM_MEMBER' as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    try {
      await api.post('/users', form);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setErrors(fieldErrors(err.details));
      }
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {formError && <div className="alert alert-error">{formError}</div>}
        <Field label="Name" error={errors.name}><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Email" error={errors.email}><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Temporary password" error={errors.password}><input type="password" value={form.password} onChange={set('password')} required minLength={8} /></Field>
        <Field label="Role" error={errors.role}>
          <select value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
        </Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Create user</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const { data, loading, error, reload } = useFetch(
    () => api.get<User[]>(`/users${qs({ search: debounced, page, pageSize: 10 })}`),
    [debounced, page],
  );

  async function update(u: User, patch: Partial<Pick<User, 'role' | 'isActive'>>, msg: string) {
    setActionError('');
    try {
      await api.patch(`/users/${u.id}`, patch);
      setNotice(msg);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Update failed');
    }
  }

  return (
    <div>
      <div className="row-between">
        <h1>Users &amp; roles</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Add user</button>
      </div>
      {notice && <div className="alert alert-success">{notice}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="filters">
        <input placeholder="Search name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!loading && !error && data && (data.data.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {data.data.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'row-muted'}>
                    <td>{u.name}{u.id === me?.id && <span className="muted"> (you)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} disabled={u.id === me?.id} onChange={(e) => update(u, { role: e.target.value as Role }, `${u.name} is now ${label(e.target.value)}.`)}>
                        {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.isActive ? <Badge value="ACTIVE" kind="status" /> : <span className="badge">Deactivated</span>}{' '}
                      {u.id !== me?.id && (
                        <button className="btn btn-small" onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? `${u.name} deactivated.` : `${u.name} reactivated.`)}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                    <td>{u.createdAt ? formatDate(u.createdAt) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta && <Pagination meta={data.meta} onPage={setPage} />}
        </>
      ))}

      {creating && <CreateUserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setNotice('User created.'); reload(); }} />}
    </div>
  );
}
