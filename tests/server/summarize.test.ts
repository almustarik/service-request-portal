import { describe, expect, it } from 'vitest';

import { summarizeActivitiesByAssignee } from '@/lib/activity/summarize';
import type { Activity } from '@/types/domain';

const HOUR = 60 * 60 * 1000;
const base = Date.parse('2026-01-01T00:00:00.000Z');
const at = (hours: number) => new Date(base + hours * HOUR).toISOString();

let sequence = 0;
function activity(overrides: Partial<Activity>): Activity {
  sequence += 1;
  return {
    id: `act-${sequence}`,
    requestId: 'REQ-1',
    type: 'STATUS_CHANGED',
    actorId: 'agent-1',
    actorName: 'Agent One',
    createdAt: at(0),
    previousValue: null,
    newValue: null,
    ...overrides,
  };
}

const assigned = (requestId: string, assigneeId: string | null, hours: number) =>
  activity({ requestId, type: 'ASSIGNEE_CHANGED', newValue: assigneeId, createdAt: at(hours) });

const resolved = (requestId: string, hours: number) =>
  activity({ requestId, type: 'STATUS_CHANGED', newValue: 'RESOLVED', createdAt: at(hours) });

describe('summarizeActivitiesByAssignee', () => {
  it('returns an empty list for no activity', () => {
    expect(summarizeActivitiesByAssignee([])).toEqual([]);
  });

  it('counts assigned and resolved requests and averages resolution time', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-1', 0),
      resolved('REQ-1', 4),
      assigned('REQ-2', 'agent-1', 10),
      resolved('REQ-2', 18),
      assigned('REQ-3', 'agent-1', 20),
    ]);

    expect(summaries).toEqual([
      {
        assigneeId: 'agent-1',
        totalAssigned: 3,
        totalResolved: 2,
        averageResolutionTime: 6 * HOUR,
      },
    ]);
  });

  it('reports each assignee separately, ordered by workload', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-2', 0),
      assigned('REQ-2', 'agent-1', 0),
      assigned('REQ-3', 'agent-1', 0),
      resolved('REQ-2', 2),
    ]);

    expect(summaries.map((summary) => summary.assigneeId)).toEqual(['agent-1', 'agent-2']);
    expect(summaries[0]).toMatchObject({ totalAssigned: 2, totalResolved: 1 });
    expect(summaries[1]).toMatchObject({ totalAssigned: 1, totalResolved: 0 });
  });

  it('credits a resolution to whoever held the request at the time', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-1', 0),
      assigned('REQ-1', 'agent-2', 5),
      resolved('REQ-1', 9),
    ]);

    // Only agent-2 held it at resolution; agent-1 no longer holds it at all.
    expect(summaries).toEqual([
      {
        assigneeId: 'agent-2',
        totalAssigned: 1,
        totalResolved: 1,
        averageResolutionTime: 4 * HOUR,
      },
    ]);
  });

  it('ignores assignments made after the request was resolved', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-1', 0),
      resolved('REQ-1', 3),
      assigned('REQ-1', 'agent-2', 8),
    ]);

    expect(summaries).toEqual([
      { assigneeId: 'agent-2', totalAssigned: 1, totalResolved: 0, averageResolutionTime: null },
      {
        assigneeId: 'agent-1',
        totalAssigned: 0,
        totalResolved: 1,
        averageResolutionTime: 3 * HOUR,
      },
    ]);
  });

  it('uses the first resolution when a request is resolved, reopened and resolved again', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-1', 0),
      resolved('REQ-1', 2),
      activity({ requestId: 'REQ-1', newValue: 'OPEN', createdAt: at(5) }),
      resolved('REQ-1', 40),
    ]);

    expect(summaries[0]?.averageResolutionTime).toBe(2 * HOUR);
  });

  it('skips records with a missing assignee instead of creating a bucket for them', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', null, 0),
      assigned('REQ-1', '', 1),
      resolved('REQ-1', 2),
      assigned('REQ-2', 'agent-1', 0),
    ]);

    expect(summaries).toEqual([
      { assigneeId: 'agent-1', totalAssigned: 1, totalResolved: 0, averageResolutionTime: null },
    ]);
  });

  it('skips records with unparseable timestamps', () => {
    const summaries = summarizeActivitiesByAssignee([
      assigned('REQ-1', 'agent-1', 0),
      activity({
        requestId: 'REQ-1',
        type: 'ASSIGNEE_CHANGED',
        newValue: 'agent-9',
        createdAt: 'not-a-date',
      }),
      resolved('REQ-1', 6),
      assigned('REQ-2', 'agent-1', 0),
      activity({ requestId: 'REQ-2', newValue: 'RESOLVED', createdAt: '' }),
    ]);

    expect(summaries).toEqual([
      {
        assigneeId: 'agent-1',
        totalAssigned: 2,
        totalResolved: 1,
        averageResolutionTime: 6 * HOUR,
      },
    ]);
  });

  it('tolerates malformed and unknown records without throwing', () => {
    const malformed = [
      null,
      undefined,
      { id: 'x' },
      activity({ requestId: '', type: 'ASSIGNEE_CHANGED', newValue: 'agent-1' }),
      activity({ requestId: 'REQ-1', type: 'ARCHIVED' as Activity['type'] }),
      assigned('REQ-1', 'agent-1', 0),
    ] as unknown as Activity[];

    expect(summarizeActivitiesByAssignee(malformed)).toEqual([
      { assigneeId: 'agent-1', totalAssigned: 1, totalResolved: 0, averageResolutionTime: null },
    ]);
  });

  it('reports unresolved requests with a null average', () => {
    const summaries = summarizeActivitiesByAssignee([assigned('REQ-1', 'agent-1', 0)]);
    expect(summaries[0]?.averageResolutionTime).toBeNull();
  });

  it('handles a large dataset in a single pass', () => {
    const activities: Activity[] = [];
    for (let index = 0; index < 50_000; index += 1) {
      const requestId = `REQ-${index}`;
      activities.push(assigned(requestId, `agent-${index % 10}`, 0));
      if (index % 2 === 0) activities.push(resolved(requestId, 3));
    }

    const startedAt = performance.now();
    const summaries = summarizeActivitiesByAssignee(activities);
    const elapsed = performance.now() - startedAt;

    expect(summaries).toHaveLength(10);
    expect(summaries.reduce((sum, entry) => sum + entry.totalAssigned, 0)).toBe(50_000);
    expect(summaries.reduce((sum, entry) => sum + entry.totalResolved, 0)).toBe(25_000);
    // Every other request is resolved, so half the agents never resolve anything.
    expect(summaries.filter((entry) => entry.totalResolved > 0)).toHaveLength(5);
    expect(
      summaries.every((entry) =>
        entry.totalResolved > 0
          ? entry.averageResolutionTime === 3 * HOUR
          : entry.averageResolutionTime === null,
      ),
    ).toBe(true);
    // Generous ceiling: this guards against an accidental nested scan, not jitter.
    expect(elapsed).toBeLessThan(2_000);
  });
});
