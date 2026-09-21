import { formatDateTime } from '@/lib/datetime';
import type { Activity } from '@/types/domain';

import { STATUS_LABELS } from './RequestBadges';

/** Stored values are plain strings and may name a status this build no longer
 *  knows, so the lookup widens rather than asserting. */
const LABEL_BY_STATUS: Record<string, string | undefined> = STATUS_LABELS;
const statusLabel = (value: string | null): string =>
  (value && LABEL_BY_STATUS[value]) || value || 'Unknown';

/**
 * Activity is an append-only audit log, so rows may predate the current schema
 * or carry missing values. Every branch degrades to readable text rather than
 * throwing — one malformed row must not take down the page.
 */
function describe(activity: Activity, nameFor: (id: string | null) => string) {
  switch (activity.type) {
    case 'CREATED':
      return { headline: 'raised this request', detail: null };

    case 'STATUS_CHANGED':
      return {
        headline: 'changed the status',
        detail: `${statusLabel(activity.previousValue)} → ${statusLabel(activity.newValue)}`,
      };

    case 'ASSIGNEE_CHANGED':
      return activity.newValue
        ? {
            headline: 'updated the assignee',
            detail: activity.previousValue
              ? `${nameFor(activity.previousValue)} → ${nameFor(activity.newValue)}`
              : `Assigned to ${nameFor(activity.newValue)}`,
          }
        : { headline: 'removed the assignee', detail: null };

    case 'COMMENTED':
      return { headline: 'added a comment', detail: activity.newValue };

    default:
      return { headline: 'updated this request', detail: null };
  }
}

export function RequestActivityTimeline({
  activity,
  userNames,
}: {
  activity: Activity[];
  /** Assignee ids stored on activity rows resolved to display names. */
  userNames: Map<string, string>;
}) {
  if (activity.length === 0) {
    return <p className="text-ink-muted text-[0.8125rem]">No activity has been recorded yet.</p>;
  }

  const nameFor = (id: string | null) => (id && userNames.get(id)) || 'an unknown user';

  return (
    <ol className="space-y-0">
      {activity.map((entry, index) => {
        const { headline, detail } = describe(entry, nameFor);
        const isLast = index === activity.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="bg-line-strong mt-1.5 size-2 shrink-0 rounded-full"
              />
              {!isLast && <span aria-hidden="true" className="bg-line mt-1 w-px flex-1" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-ink text-[0.8125rem]">
                <span className="font-medium">{entry.actorName || 'Unknown user'}</span> {headline}
              </p>
              {detail && <p className="text-ink-muted mt-0.5 text-[0.8125rem]">{detail}</p>}
              <time dateTime={entry.createdAt} className="text-ink-subtle mt-0.5 block text-xs">
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
