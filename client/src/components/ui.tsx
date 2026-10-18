import { ReactNode, useEffect } from 'react';
import { Meta } from '../types';
import { label } from '../format';

// ---------- Page states: loading / empty / error / success ----------
export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export const SuccessBox = ({ message }: { message: string }) => (
  <div className="alert alert-success" role="status">
    {message}
  </div>
);

// ---------- Badges ----------
export const Badge = ({ value, kind }: { value: string; kind: 'status' | 'priority' | 'role' }) => (
  <span className={`badge badge-${kind}-${value.toLowerCase()}`}>{label(value)}</span>
);

export const ProgressBar = ({ percent }: { percent: number }) => (
  <div className="progress" title={`${percent}% complete`}>
    <div className="progress-fill" style={{ width: `${percent}%` }} />
    <span className="progress-label">{percent}%</span>
  </div>
);

// ---------- Pagination ----------
export function Pagination({ meta, onPage }: { meta: Meta; onPage: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-small" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        ← Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages} ({meta.total} results)
      </span>
      <button className="btn btn-small" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next →
      </button>
    </div>
  );
}

// ---------- Modal dialog ----------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Form field wrapper (label + input + error message) ----------
export function Field({ label: text, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{text}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

// Turns the API's validation details [{path, message}] into { path: message } for <Field error=...>
export function fieldErrors(details?: { path: string; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  details?.forEach((d) => {
    if (!out[d.path]) out[d.path] = d.message;
  });
  return out;
}
