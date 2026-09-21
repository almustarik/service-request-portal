import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@/types/domain';

const signedInUser: User = {
  id: 'agent-1',
  name: 'Ahmed Faruk',
  email: 'ahmed.faruk@assunnah.test',
};

// The route handlers are exercised directly, so the only thing that needs
// replacing is the cookie-backed session lookup.
const getSession = vi.fn<() => Promise<User | null>>();
vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSession(),
  SESSION_COOKIE: 'srp_session',
}));

const { GET: listRequests } = await import('@/app/api/requests/route');
const { GET: getRequest, PATCH: patchRequest } = await import('@/app/api/requests/[id]/route');

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const patch = (id: string, body: unknown) =>
  patchRequest(
    new Request(`http://localhost/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    context(id),
  );

beforeEach(() => {
  getSession.mockResolvedValue(signedInUser);
});

describe('GET /api/requests', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    getSession.mockResolvedValue(null);

    const response = await listRequests(new Request('http://localhost/api/requests'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('returns a page of requests with pagination metadata', async () => {
    const response = await listRequests(
      new Request('http://localhost/api/requests?pageSize=25&page=2'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(25);
    expect(body.pagination).toMatchObject({ page: 2, pageSize: 25, total: 200 });
  });

  it('applies filters and sorting from the query string', async () => {
    const response = await listRequests(
      new Request(
        'http://localhost/api/requests?status=OPEN&sort=priority&direction=desc&pageSize=50',
      ),
    );
    const body = await response.json();

    expect(body.data.every((request: { status: string }) => request.status === 'OPEN')).toBe(true);
    expect(body.data[0].priority).toBe('URGENT');
  });

  it('normalises invalid query parameters rather than failing the request', async () => {
    const response = await listRequests(
      new Request('http://localhost/api/requests?status=NONSENSE&page=-4&pageSize=9999'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination).toMatchObject({ page: 1, pageSize: 25, total: 200 });
  });

  it('never returns the whole dataset in one response', async () => {
    const response = await listRequests(new Request('http://localhost/api/requests?pageSize=100'));
    const body = await response.json();

    expect(body.data).toHaveLength(100);
    expect(body.pagination.total).toBe(200);
  });
});

describe('GET /api/requests/[id]', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    getSession.mockResolvedValue(null);

    const response = await getRequest(
      new Request('http://localhost/api/requests/REQ-10000'),
      context('REQ-10000'),
    );

    expect(response.status).toBe(401);
  });

  it('returns the request with its activity', async () => {
    const response = await getRequest(
      new Request('http://localhost/api/requests/REQ-10000'),
      context('REQ-10000'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.request.id).toBe('REQ-10000');
    expect(body.request.activity.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    for (const id of ['REQ-99999', 'nonsense', '../../etc/passwd']) {
      const response = await getRequest(
        new Request(`http://localhost/api/requests/${id}`),
        context(id),
      );
      expect(response.status).toBe(404);
    }
  });
});

describe('PATCH /api/requests/[id]', () => {
  it('rejects an unauthenticated caller with 401 without touching the data', async () => {
    getSession.mockResolvedValue(null);

    const response = await patch('REQ-10000', { status: 'CLOSED' });

    expect(response.status).toBe(401);

    getSession.mockResolvedValue(signedInUser);
    const after = await getRequest(
      new Request('http://localhost/api/requests/REQ-10000'),
      context('REQ-10000'),
    );
    expect((await after.json()).request.status).not.toBe('CLOSED');
  });

  it('applies a valid status change and records the actor', async () => {
    const response = await patch('REQ-10010', { status: 'IN_PROGRESS' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.request.status).toBe('IN_PROGRESS');
    expect(body.request.activity.at(-1)).toMatchObject({
      type: 'STATUS_CHANGED',
      actorId: signedInUser.id,
      newValue: 'IN_PROGRESS',
    });
  });

  it('applies a valid assignee change', async () => {
    const response = await patch('REQ-10011', { assigneeId: 'agent-4' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.request.assignee.id).toBe('agent-4');
  });

  it('rejects an unknown status with 422 and a field message', async () => {
    const response = await patch('REQ-10012', { status: 'ON_HOLD' });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.fields.status).toBeTruthy();
  });

  it('rejects an assignee who is not a service desk agent with 422', async () => {
    const response = await patch('REQ-10013', { assigneeId: 'user-1' });

    expect(response.status).toBe(422);
    expect((await response.json()).error.fields.assigneeId).toBeTruthy();
  });

  it('rejects an empty payload with 422', async () => {
    const response = await patch('REQ-10014', {});

    expect(response.status).toBe(422);
    expect((await response.json()).error.fields.form).toBeTruthy();
  });

  it('rejects a malformed body with 422 rather than a 500', async () => {
    const response = await patch('REQ-10015', 'not json at all');

    expect(response.status).toBe(422);
  });

  it('returns 404 for an unknown request', async () => {
    const response = await patch('REQ-99999', { status: 'CLOSED' });

    expect(response.status).toBe(404);
  });

  it('is idempotent when the same update is submitted twice', async () => {
    const first = await patch('REQ-10016', { status: 'RESOLVED' });
    const firstBody = await first.json();

    const second = await patch('REQ-10016', { status: 'RESOLVED' });
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    expect(secondBody.request.activity).toHaveLength(firstBody.request.activity.length);
    expect(secondBody.request.updatedAt).toBe(firstBody.request.updatedAt);
  });

  it('never exposes internal detail in an error body', async () => {
    const body = await (await patch('REQ-99999', { status: 'CLOSED' })).json();

    expect(JSON.stringify(body)).not.toMatch(/sqlite|SELECT|at Object|node_modules/i);
  });
});
