import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { label, toInputDate } from '../format';
import { TASK_PRIORITIES, TASK_STATUSES, TaskDetail, TaskPriority, TaskStatus, User } from '../types';
import { Field, fieldErrors, Modal } from './ui';

// Create (pass projectId) or edit (pass task). `members` = people who can be assigned.
export default function TaskFormModal({
  projectId,
  task,
  members,
  onClose,
  onSaved,
}: {
  projectId: number;
  task?: TaskDetail;
  members: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task?.assigneeId ? String(task.assigneeId) : '',
    priority: (task?.priority ?? 'MEDIUM') as TaskPriority,
    status: (task?.status ?? 'TODO') as TaskStatus,
    dueDate: task ? toInputDate(task.dueDate) : '',
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
    const payload = { ...form, assigneeId: form.assigneeId ? Number(form.assigneeId) : null };
    try {
      if (task) await api.patch(`/tasks/${task.id}`, payload);
      else await api.post('/tasks', { ...payload, projectId });
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
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {formError && <div className="alert alert-error">{formError}</div>}
        <Field label="Title" error={errors.title}>
          <input value={form.title} onChange={set('title')} required minLength={3} maxLength={200} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea value={form.description} onChange={set('description')} rows={3} />
        </Field>
        <div className="grid-2">
          <Field label="Assignee" error={errors.assigneeId}>
            <select value={form.assigneeId} onChange={set('assigneeId')}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date" error={errors.dueDate}>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} required />
          </Field>
          <Field label="Priority" error={errors.priority}>
            <select value={form.priority} onChange={set('priority')}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{label(p)}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={errors.status}>
            <select value={form.status} onChange={set('status')}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
