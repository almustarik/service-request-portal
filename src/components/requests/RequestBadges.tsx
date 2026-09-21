import type { RequestPriority, RequestStatus } from '@/types/domain';

/* Status and priority are both conveyed by their text label, never by colour
 * alone; priority additionally carries a filled-bar glyph so the ordering is
 * readable without relying on hue. */

const STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  OPEN: 'bg-info-50 text-info-700 border-info-200',
  IN_PROGRESS: 'bg-warn-50 text-warn-700 border-warn-200',
  RESOLVED: 'bg-brand-50 text-brand-700 border-brand-100',
  CLOSED: 'bg-canvas text-ink-muted border-line-strong',
};

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const PRIORITY_STYLES: Record<RequestPriority, string> = {
  LOW: 'text-ink-muted',
  MEDIUM: 'text-info-700',
  HIGH: 'text-warn-700',
  URGENT: 'text-danger-600 font-semibold',
};

const PRIORITY_LEVEL: Record<RequestPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RequestPriorityBadge({ priority }: { priority: RequestPriority }) {
  const level = PRIORITY_LEVEL[priority];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap ${PRIORITY_STYLES[priority]}`}
    >
      <span className="flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`w-0.5 rounded-xs ${step <= level ? 'bg-current' : 'bg-line-strong'}`}
            style={{ height: `${3 + step * 2}px` }}
          />
        ))}
      </span>
      <span className="text-xs">{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export { PRIORITY_LABELS, STATUS_LABELS };
