'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { ApiErrorBody } from '@/lib/api/http';
import {
  REQUEST_STATUSES,
  type RequestStatus,
  type ServiceRequestDetail,
  type User,
} from '@/types/domain';

import { STATUS_LABELS } from './RequestBadges';

interface FormValue {
  status: RequestStatus;
  assigneeId: string | null;
}

type Feedback = { tone: 'success' | 'error'; message: string };

/**
 * Applies status and assignee changes as soon as a control changes, updating the
 * UI first and rolling back if the server rejects the change. Only one update is
 * ever in flight: the fieldset is disabled while saving, so repeated clicks
 * cannot queue duplicate mutations.
 */
export function RequestUpdateForm({
  request,
  agents,
}: {
  request: ServiceRequestDetail;
  agents: User[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<FormValue>({
    status: request.status,
    assigneeId: request.assignee?.id ?? null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const lastChangedControl = useRef<HTMLSelectElement | null>(null);

  async function apply(change: Partial<FormValue>, control: HTMLSelectElement) {
    if (isSaving) return;

    const previous = value;
    lastChangedControl.current = control;
    setValue({ ...value, ...change });
    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setValue(previous);
        setFeedback({
          tone: 'error',
          message:
            response.status === 401
              ? 'Your session has expired. Sign in again to continue.'
              : (body?.error.message ?? 'Unable to update this request. Please try again.'),
        });
        return;
      }

      const { request: updated } = (await response.json()) as { request: ServiceRequestDetail };
      setValue({ status: updated.status, assigneeId: updated.assignee?.id ?? null });
      setFeedback({ tone: 'success', message: 'Request updated successfully.' });

      // Re-renders the server component tree so the activity timeline and the
      // header badges reflect the change that was just saved.
      router.refresh();
    } catch {
      setValue(previous);
      setFeedback({
        tone: 'error',
        message: 'Could not reach the server. Your change was not saved.',
      });
    } finally {
      setIsSaving(false);
      // Disabling the fieldset drops focus; put it back where the user left it.
      requestAnimationFrame(() => lastChangedControl.current?.focus());
    }
  }

  return (
    <div className="space-y-3">
      <fieldset disabled={isSaving} aria-busy={isSaving} className="space-y-3">
        <legend className="sr-only">Update this request</legend>

        <div>
          <label htmlFor="update-status" className="field-label">
            Status
          </label>
          <select
            id="update-status"
            value={value.status}
            onChange={(event) => {
              // The selected value is matched against the known statuses rather
              // than asserted, so a stale option can never widen the union.
              const status = REQUEST_STATUSES.find((known) => known === event.target.value);
              if (status) apply({ status }, event.target);
            }}
            className="field-control"
          >
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="update-assignee" className="field-label">
            Assignee
          </label>
          <select
            id="update-assignee"
            value={value.assigneeId ?? ''}
            onChange={(event) => apply({ assigneeId: event.target.value || null }, event.target)}
            className="field-control"
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <p
        role="status"
        aria-live="polite"
        className={`min-h-4 text-xs ${
          feedback?.tone === 'error' ? 'text-danger-700' : 'text-brand-700'
        }`}
      >
        {isSaving ? 'Saving…' : (feedback?.message ?? '')}
      </p>
    </div>
  );
}
