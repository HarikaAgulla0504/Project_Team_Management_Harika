import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { label, toInputDate } from '../format';
import { PROJECT_STATUSES, ProjectDetail, ProjectStatus } from '../types';
import { Field, fieldErrors, Modal } from './ui';

// Used for BOTH creating (no `project` prop) and editing (`project` passed in).
export default function ProjectFormModal({
  project,
  onClose,
  onSaved,
}: {
  project?: ProjectDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    startDate: project ? toInputDate(project.startDate) : new Date().toISOString().slice(0, 10),
    deadline: project ? toInputDate(project.deadline) : '',
    status: (project?.status ?? 'PLANNING') as ProjectStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');
    try {
      if (project) await api.patch(`/projects/${project.id}`, form);
      else await api.post('/projects', form);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(fieldErrors(err.details));
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {formError && <div className="alert alert-error">{formError}</div>}
        <Field label="Name" error={errors.name}>
          <input value={form.name} onChange={set('name')} required minLength={3} maxLength={120} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} />
        </Field>
        <div className="grid-2">
          <Field label="Start date" error={errors.startDate}>
            <input type="date" value={form.startDate} onChange={set('startDate')} required />
          </Field>
          <Field label="Deadline" error={errors.deadline}>
            <input type="date" value={form.deadline} onChange={set('deadline')} required />
          </Field>
        </div>
        <Field label="Status" error={errors.status}>
          <select value={form.status} onChange={set('status')}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
