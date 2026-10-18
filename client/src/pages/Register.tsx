import { FormEvent, useState } from 'react';
import Icon from '../components/Icon';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Field, fieldErrors } from '../components/ui';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await register(form.name, form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrors(fieldErrors(err.details));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card form" onSubmit={submit}>
        <div className="auth-logo"><Icon name="layers" size={28} /></div>
        <h1>Create your account</h1>
        <p className="muted">Join your team and start tracking work.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Field label="Full name" error={errors.name}>
          <input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        </Field>
        <Field label="Password (min 8 chars, letters + a number)" error={errors.password}>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
        </Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted">New accounts start as Team Members. An admin can change your role. <Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
