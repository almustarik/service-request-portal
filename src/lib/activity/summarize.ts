import type { Activity } from '@/types/domain';

export interface AssigneeSummary {
  assigneeId: string;
  totalAssigned: number;
  totalResolved: number;
  /** Mean milliseconds from assignment to resolution, or null if never resolved. */
  averageResolutionTime: number | null;
}

interface RequestTrail {
  /** Assignment events as encountered, deliberately left unsorted. */
  assignments: { assigneeId: string; at: number }[];
  resolvedAt: number | null;
}

interface Tally {
  totalAssigned: number;
  totalResolved: number;
  resolutionTotal: number;
  resolutionCount: number;
}

function parseTimestamp(value: string | undefined | null): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Aggregates a flat activity stream into per-assignee workload figures.
 *
 * Input is treated as untrusted: records with missing assignees, malformed
 * timestamps or unknown shapes are skipped rather than throwing, because the
 * stream is an append-only audit log that predates the current schema.
 *
 * Runs in O(n): one pass groups events by request, a second pass walks each
 * request's own events. No activity is visited more than twice and nothing is
 * sorted, so a reassigned request costs the same as a simple one.
 */
export function summarizeActivitiesByAssignee(activities: readonly Activity[]): AssigneeSummary[] {
  const trails = new Map<string, RequestTrail>();

  for (const activity of activities) {
    if (!activity || typeof activity.requestId !== 'string' || !activity.requestId) continue;

    let trail = trails.get(activity.requestId);
    if (!trail) {
      trail = { assignments: [], resolvedAt: null };
      trails.set(activity.requestId, trail);
    }

    if (activity.type === 'ASSIGNEE_CHANGED') {
      const assigneeId = activity.newValue;
      const at = parseTimestamp(activity.createdAt);
      // An unassignment (null) or an undated record tells us nothing about who
      // owned the request, so it cannot open a resolution window.
      if (assigneeId && at !== null) {
        trail.assignments.push({ assigneeId, at });
      }
      continue;
    }

    if (activity.type === 'STATUS_CHANGED' && activity.newValue === 'RESOLVED') {
      const at = parseTimestamp(activity.createdAt);
      // Requests can bounce between resolved and reopened; the first resolution
      // is the one that reflects how long the assignee actually took.
      if (at !== null && (trail.resolvedAt === null || at < trail.resolvedAt)) {
        trail.resolvedAt = at;
      }
    }
  }

  const tallies = new Map<string, Tally>();
  const tallyFor = (assigneeId: string): Tally => {
    let tally = tallies.get(assigneeId);
    if (!tally) {
      tally = { totalAssigned: 0, totalResolved: 0, resolutionTotal: 0, resolutionCount: 0 };
      tallies.set(assigneeId, tally);
    }
    return tally;
  };

  for (const trail of trails.values()) {
    if (trail.assignments.length === 0) continue;

    let current: { assigneeId: string; at: number } | null = null;
    let owningAtResolution: { assigneeId: string; at: number } | null = null;

    for (const assignment of trail.assignments) {
      if (current === null || assignment.at > current.at) {
        current = assignment;
      }
      // Credit the resolution to whoever held the request when it was resolved,
      // not to whoever happens to hold it now.
      if (
        trail.resolvedAt !== null &&
        assignment.at <= trail.resolvedAt &&
        (owningAtResolution === null || assignment.at > owningAtResolution.at)
      ) {
        owningAtResolution = assignment;
      }
    }

    tallyFor(current!.assigneeId).totalAssigned += 1;

    if (owningAtResolution && trail.resolvedAt !== null) {
      const tally = tallyFor(owningAtResolution.assigneeId);
      tally.totalResolved += 1;
      tally.resolutionTotal += trail.resolvedAt - owningAtResolution.at;
      tally.resolutionCount += 1;
    }
  }

  return Array.from(tallies, ([assigneeId, tally]) => ({
    assigneeId,
    totalAssigned: tally.totalAssigned,
    totalResolved: tally.totalResolved,
    averageResolutionTime:
      tally.resolutionCount === 0 ? null : tally.resolutionTotal / tally.resolutionCount,
  })).sort((a, b) => b.totalAssigned - a.totalAssigned || a.assigneeId.localeCompare(b.assigneeId));
}
