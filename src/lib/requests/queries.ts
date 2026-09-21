import { randomUUID } from 'node:crypto';

import { getDb } from '@/lib/db/client';
import type {
  Activity,
  PaginatedResponse,
  ServiceRequestDetail,
  ServiceRequestListItem,
  User,
} from '@/types/domain';

import { UNASSIGNED, type RequestQuery, type SortField } from './search-params';

const SORT_COLUMNS: Record<SortField, string> = {
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  priority: 'priority_rank',
  status: 'status_rank',
  subject: 'subject',
};

const LIST_COLUMNS = `
  r.id, r.subject, r.requester_id, r.requester_name, r.category, r.priority, r.status,
  r.created_at, r.updated_at, r.assignee_id, a.name AS assignee_name
`;

interface ListRow {
  id: string;
  subject: string;
  requester_id: string;
  requester_name: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  assignee_id: string | null;
  assignee_name: string | null;
}

/** The detail query selects the two email columns the list query leaves out. */
interface DetailRow extends ListRow {
  description: string;
  requester_email: string;
  assignee_email: string | null;
}

interface ActivityRow {
  id: string;
  request_id: string;
  type: string;
  actor_id: string;
  actor_name: string;
  created_at: string;
  previous_value: string | null;
  new_value: string | null;
}

/* SQLite hands back untyped column values, so the row mappers below are the one
 * boundary where `unknown` becomes a domain type. The casts are safe because the
 * schema, the seed data and every write path are all under our control. */
function toListItem(row: ListRow): ServiceRequestListItem {
  return {
    id: row.id,
    subject: row.subject,
    requester: { id: row.requester_id, name: row.requester_name },
    category: row.category as ServiceRequestListItem['category'],
    priority: row.priority as ServiceRequestListItem['priority'],
    status: row.status as ServiceRequestListItem['status'],
    assignee:
      row.assignee_id && row.assignee_name
        ? { id: row.assignee_id, name: row.assignee_name }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDetail(row: DetailRow, activity: Activity[]): ServiceRequestDetail {
  return {
    ...toListItem(row),
    description: row.description,
    requester: { id: row.requester_id, name: row.requester_name, email: row.requester_email },
    assignee:
      row.assignee_id && row.assignee_name
        ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email ?? '' }
        : null,
    activity,
  };
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    requestId: row.request_id,
    type: row.type as Activity['type'],
    actorId: row.actor_id,
    actorName: row.actor_name,
    createdAt: row.created_at,
    previousValue: row.previous_value,
    newValue: row.new_value,
  };
}

/** `%` and `_` are LIKE wildcards; a user searching for "50%" means the literal. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildFilters(query: RequestQuery): { clause: string; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];

  if (query.search) {
    const term = `%${escapeLike(query.search)}%`;
    conditions.push(
      `(r.id LIKE ? ESCAPE '\\' OR r.subject LIKE ? ESCAPE '\\' OR r.requester_name LIKE ? ESCAPE '\\')`,
    );
    params.push(term, term, term);
  }
  if (query.status) {
    conditions.push('r.status = ?');
    params.push(query.status);
  }
  if (query.priority) {
    conditions.push('r.priority = ?');
    params.push(query.priority);
  }
  if (query.category) {
    conditions.push('r.category = ?');
    params.push(query.category);
  }
  if (query.assignee === UNASSIGNED) {
    conditions.push('r.assignee_id IS NULL');
  } else if (query.assignee) {
    conditions.push('r.assignee_id = ?');
    params.push(query.assignee);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export function queryRequests(query: RequestQuery): PaginatedResponse<ServiceRequestListItem> {
  const db = getDb();
  const { clause, params } = buildFilters(query);

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM requests r ${clause}`)
    .get(...params) as { total: number };

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  // A page beyond the end is clamped rather than returned empty, so a stale
  // `?page=` from a since-narrowed filter still lands on real results.
  const page = Math.min(query.page, totalPages);

  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  // `id` breaks ties so that OFFSET paging cannot repeat or skip rows when the
  // sort column holds duplicates.
  const orderBy = `ORDER BY r.${SORT_COLUMNS[query.sort]} ${direction}, r.id ASC`;

  const rows = db
    .prepare(
      `SELECT ${LIST_COLUMNS}
       FROM requests r
       LEFT JOIN users a ON a.id = r.assignee_id
       ${clause}
       ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.pageSize, (page - 1) * query.pageSize) as unknown as ListRow[];

  return {
    data: rows.map(toListItem),
    pagination: { page, pageSize: query.pageSize, total, totalPages },
  };
}

export function getRequestById(id: string): ServiceRequestDetail | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT ${LIST_COLUMNS}, r.description, req.email AS requester_email, a.email AS assignee_email
       FROM requests r
       JOIN users req ON req.id = r.requester_id
       LEFT JOIN users a ON a.id = r.assignee_id
       WHERE r.id = ?`,
    )
    .get(id) as unknown as DetailRow | undefined;

  if (!row) return null;

  const activityRows = db
    .prepare(
      `SELECT id, request_id, type, actor_id, actor_name, created_at, previous_value, new_value
       FROM activity WHERE request_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .all(id) as unknown as ActivityRow[];

  return toDetail(row, activityRows.map(toActivity));
}

export function listAgents(): User[] {
  return (
    getDb()
      .prepare('SELECT id, name, email FROM users WHERE is_agent = 1 ORDER BY name ASC')
      .all() as unknown as User[]
  ).map((agent) => ({ id: agent.id, name: agent.name, email: agent.email }));
}

/** Full activity stream, used by the team performance report. Kept as a single
 *  read because the summariser walks the whole log in one pass. */
export function listAllActivity(): Activity[] {
  return (
    getDb()
      .prepare(
        `SELECT id, request_id, type, actor_id, actor_name, created_at, previous_value, new_value
         FROM activity`,
      )
      .all() as unknown as ActivityRow[]
  ).map(toActivity);
}

export interface RequestUpdate {
  status?: ServiceRequestDetail['status'];
  assigneeId?: string | null;
}

export type UpdateRequestResult =
  | { ok: true; request: ServiceRequestDetail }
  | { ok: false; reason: 'NOT_FOUND' | 'INVALID_ASSIGNEE' };

/**
 * Applies a status and/or assignee change and records one activity row per field
 * that actually changed. Re-submitting the current values is a no-op, which is
 * what makes repeated clicks from an impatient user harmless.
 */
export function updateRequest(id: string, update: RequestUpdate, actor: User): UpdateRequestResult {
  const db = getDb();
  const current = getRequestById(id);
  if (!current) return { ok: false, reason: 'NOT_FOUND' };

  const nextStatus = update.status ?? current.status;
  const nextAssigneeId =
    update.assigneeId === undefined ? (current.assignee?.id ?? null) : update.assigneeId;

  if (nextAssigneeId !== null && nextAssigneeId !== current.assignee?.id) {
    const exists = db
      .prepare('SELECT 1 AS found FROM users WHERE id = ? AND is_agent = 1')
      .get(nextAssigneeId);
    if (!exists) return { ok: false, reason: 'INVALID_ASSIGNEE' };
  }

  const statusChanged = nextStatus !== current.status;
  const assigneeChanged = nextAssigneeId !== (current.assignee?.id ?? null);
  if (!statusChanged && !assigneeChanged) {
    return { ok: true, request: current };
  }

  const now = new Date().toISOString();
  const insertActivity = db.prepare(
    `INSERT INTO activity (id, request_id, type, actor_id, actor_name, created_at, previous_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE requests SET status = ?, assignee_id = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      nextAssigneeId,
      now,
      id,
    );

    if (statusChanged) {
      insertActivity.run(
        randomUUID(),
        id,
        'STATUS_CHANGED',
        actor.id,
        actor.name,
        now,
        current.status,
        nextStatus,
      );
    }
    if (assigneeChanged) {
      insertActivity.run(
        randomUUID(),
        id,
        'ASSIGNEE_CHANGED',
        actor.id,
        actor.name,
        now,
        current.assignee?.id ?? null,
        nextAssigneeId,
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ok: true, request: getRequestById(id)! };
}
