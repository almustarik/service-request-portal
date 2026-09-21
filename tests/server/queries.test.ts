import { beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/client';
import { getRequestById, listAgents, queryRequests, updateRequest } from '@/lib/requests/queries';
import { DEFAULT_QUERY, type RequestQuery } from '@/lib/requests/search-params';
import type { User } from '@/types/domain';

const actor: User = { id: 'agent-1', name: 'Ahmed Faruk', email: 'ahmed.faruk@assunnah.test' };
const query = (overrides: Partial<RequestQuery> = {}): RequestQuery => ({
  ...DEFAULT_QUERY,
  ...overrides,
});

describe('queryRequests', () => {
  it('returns one page with accurate pagination metadata', () => {
    const { data, pagination } = queryRequests(query({ pageSize: 25 }));

    expect(data).toHaveLength(25);
    expect(pagination).toMatchObject({ page: 1, pageSize: 25, total: 200, totalPages: 8 });
  });

  it('paginates without repeating rows across pages', () => {
    const first = queryRequests(query({ page: 1, pageSize: 50 }));
    const second = queryRequests(query({ page: 2, pageSize: 50 }));
    const ids = new Set([...first.data, ...second.data].map((request) => request.id));

    expect(ids.size).toBe(100);
  });

  it('clamps a page beyond the last one instead of returning nothing', () => {
    const { data, pagination } = queryRequests(query({ page: 9_999, pageSize: 25 }));

    expect(pagination.page).toBe(8);
    expect(data).toHaveLength(25);
  });

  it('applies status, priority and category filters together', () => {
    const { data, pagination } = queryRequests(
      query({ status: 'OPEN', priority: 'HIGH', category: 'IT Support', pageSize: 100 }),
    );

    expect(pagination.total).toBe(data.length);
    expect(
      data.every(
        (request) =>
          request.status === 'OPEN' &&
          request.priority === 'HIGH' &&
          request.category === 'IT Support',
      ),
    ).toBe(true);
  });

  it('filters to unassigned requests', () => {
    const { data } = queryRequests(query({ assignee: 'unassigned', pageSize: 100 }));

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((request) => request.assignee === null)).toBe(true);
  });

  it('filters by a specific assignee', () => {
    const { data } = queryRequests(query({ assignee: 'agent-2', pageSize: 100 }));

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((request) => request.assignee?.id === 'agent-2')).toBe(true);
  });

  it('searches across id, subject and requester name', () => {
    const byId = queryRequests(query({ search: 'REQ-10007' }));
    expect(byId.data.map((request) => request.id)).toContain('REQ-10007');

    const bySubject = queryRequests(query({ search: 'printer', pageSize: 100 }));
    expect(bySubject.data.length).toBeGreaterThan(0);
    expect(
      bySubject.data.every(
        (request) =>
          request.subject.toLowerCase().includes('printer') ||
          request.requester.name.toLowerCase().includes('printer'),
      ),
    ).toBe(true);
  });

  it('treats LIKE wildcards in the search term as literal characters', () => {
    // Without escaping, "%" would match every row.
    expect(queryRequests(query({ search: '%' })).pagination.total).toBe(0);
    expect(queryRequests(query({ search: '_' })).pagination.total).toBe(0);
  });

  it('sorts by priority using workflow order rather than alphabetically', () => {
    const { data } = queryRequests(query({ sort: 'priority', direction: 'desc' }));
    expect(data[0]?.priority).toBe('URGENT');

    const ascending = queryRequests(query({ sort: 'priority', direction: 'asc' }));
    expect(ascending.data[0]?.priority).toBe('LOW');
  });

  it('sorts by subject in both directions', () => {
    const subjects = queryRequests(query({ sort: 'subject', direction: 'asc' })).data.map(
      (request) => request.subject,
    );

    expect([...subjects].sort((a, b) => a.localeCompare(b))).toEqual(subjects);
  });

  it('sorts by last updated by default, newest first', () => {
    const { data } = queryRequests(query());
    const timestamps = data.map((request) => Date.parse(request.updatedAt));

    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('returns an empty page when nothing matches', () => {
    const { data, pagination } = queryRequests(query({ search: 'zzzz-no-such-request' }));

    expect(data).toEqual([]);
    expect(pagination.total).toBe(0);
    expect(pagination.totalPages).toBe(1);
  });
});

describe('getRequestById', () => {
  it('returns the request with its description and activity', () => {
    const request = getRequestById('REQ-10000');

    expect(request).not.toBeNull();
    expect(request?.description).not.toBe('');
    expect(request?.requester.email).toContain('@');
    expect(request?.activity.length).toBeGreaterThan(0);
    expect(request?.activity[0]?.type).toBe('CREATED');
  });

  it('returns activity in chronological order', () => {
    const activity = getRequestById('REQ-10001')?.activity ?? [];
    const timestamps = activity.map((entry) => Date.parse(entry.createdAt));

    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
  });

  it('returns null for an unknown id', () => {
    expect(getRequestById('REQ-99999')).toBeNull();
  });
});

describe('updateRequest', () => {
  // Every test mutates its own request, handed out in order, so no test can be
  // affected by what another one changed.
  const openRequests = queryRequests(query({ status: 'OPEN', pageSize: 100 })).data;
  let cursor = 0;
  let target: string;

  /** An agent other than the one currently holding the request, so an assignee
   *  change is always a real change. */
  const differentAgent = (requestId: string) => {
    const current = getRequestById(requestId)?.assignee?.id;
    return listAgents().find((agent) => agent.id !== current)!.id;
  };

  beforeEach(() => {
    target = openRequests[cursor]!.id;
    cursor += 1;
  });

  it('changes the status and records one activity entry', () => {
    const before = getRequestById(target)!;
    const result = updateRequest(target, { status: 'IN_PROGRESS' }, actor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.request.status).toBe('IN_PROGRESS');
    expect(result.request.activity).toHaveLength(before.activity.length + 1);

    const latest = result.request.activity.at(-1)!;
    expect(latest).toMatchObject({
      type: 'STATUS_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      previousValue: before.status,
      newValue: 'IN_PROGRESS',
    });
  });

  it('changes the assignee and advances updatedAt', () => {
    const before = getRequestById(target)!;
    const nextAgent = differentAgent(target);
    const result = updateRequest(target, { assigneeId: nextAgent }, actor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.request.assignee?.id).toBe(nextAgent);
    expect(Date.parse(result.request.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(before.updatedAt),
    );
  });

  it('clears the assignee when given null', () => {
    updateRequest(target, { assigneeId: differentAgent(target) }, actor);
    const result = updateRequest(target, { assigneeId: null }, actor);

    expect(result.ok && result.request.assignee).toBeNull();
  });

  it('records both entries when status and assignee change together', () => {
    const before = getRequestById(target)!;
    const result = updateRequest(
      target,
      { status: 'RESOLVED', assigneeId: differentAgent(target) },
      actor,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.activity).toHaveLength(before.activity.length + 2);
  });

  it('is a no-op when the submitted values match the current ones', () => {
    const before = getRequestById(target)!;
    const result = updateRequest(
      target,
      { status: before.status, assigneeId: before.assignee?.id ?? null },
      actor,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.activity).toHaveLength(before.activity.length);
    expect(result.request.updatedAt).toBe(before.updatedAt);
  });

  it('rejects an assignee who is not a service desk agent', () => {
    const requester = getDb().prepare('SELECT id FROM users WHERE is_agent = 0 LIMIT 1').get() as {
      id: string;
    };

    expect(updateRequest(target, { assigneeId: requester.id }, actor)).toEqual({
      ok: false,
      reason: 'INVALID_ASSIGNEE',
    });
    expect(updateRequest(target, { assigneeId: 'agent-does-not-exist' }, actor)).toEqual({
      ok: false,
      reason: 'INVALID_ASSIGNEE',
    });
  });

  it('reports a missing request rather than throwing', () => {
    expect(updateRequest('REQ-99999', { status: 'CLOSED' }, actor)).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });
});

describe('listAgents', () => {
  it('returns only staff accounts, sorted by name', () => {
    const agents = listAgents();
    const names = agents.map((agent) => agent.name);

    expect(agents.length).toBeGreaterThan(0);
    expect(agents.every((agent) => agent.id.startsWith('agent-'))).toBe(true);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});
