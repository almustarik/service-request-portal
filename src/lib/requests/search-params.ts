import {
  REQUEST_CATEGORIES,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  type RequestCategory,
  type RequestPriority,
  type RequestStatus,
} from '@/types/domain';

export const SORT_FIELDS = ['updatedAt', 'createdAt', 'priority', 'status', 'subject'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 120;

/** Sentinel for "has nobody assigned", which cannot be expressed as a user id. */
export const UNASSIGNED = 'unassigned';

export interface RequestQuery {
  search: string;
  status: RequestStatus | null;
  priority: RequestPriority | null;
  category: RequestCategory | null;
  assignee: string | null;
  sort: SortField;
  direction: SortDirection;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: RequestQuery = {
  search: '',
  status: null,
  priority: null,
  category: null,
  assignee: null,
  sort: 'updatedAt',
  direction: 'desc',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export type RawSearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(params: RawSearchParams, key: string): string | null {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single === undefined || single === '' ? null : single;
}

/** Returns the matching member of the allowlist, so an unknown value is dropped
 *  rather than narrowed by a cast. */
function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function toPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : DEFAULT_QUERY.page;
}

function toPageSize(value: string | null): number {
  const size = Number(value);
  return PAGE_SIZES.find((allowed) => allowed === size) ?? DEFAULT_PAGE_SIZE;
}

/**
 * Read parameters are normalised rather than rejected: a hand-edited, stale or
 * truncated URL should still render a sensible list instead of an error page.
 * Write payloads are the opposite — see `validation.ts`, where an unexpected
 * value is a client bug and earns a 422.
 *
 * Normalisation uses an explicit allowlist rather than a schema, which keeps Zod
 * out of this module. The filter controls are a Client Component and import it
 * for `buildRequestsHref`, so anything it pulls in ships to the browser.
 */
export function parseRequestQuery(params: RawSearchParams): RequestQuery {
  const assignee = readParam(params, 'assignee')?.trim() ?? '';

  return {
    search: (readParam(params, 'search') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    status: oneOf(REQUEST_STATUSES, readParam(params, 'status')),
    priority: oneOf(REQUEST_PRIORITIES, readParam(params, 'priority')),
    category: oneOf(REQUEST_CATEGORIES, readParam(params, 'category')),
    assignee: assignee.length > 0 && assignee.length <= 64 ? assignee : null,
    sort: oneOf(SORT_FIELDS, readParam(params, 'sort')) ?? DEFAULT_QUERY.sort,
    direction: oneOf(SORT_DIRECTIONS, readParam(params, 'direction')) ?? DEFAULT_QUERY.direction,
    page: toPage(readParam(params, 'page')),
    pageSize: toPageSize(readParam(params, 'pageSize')),
  };
}

/**
 * Serialises a query back to a `/requests` URL, omitting anything at its default
 * so shared links stay readable. Any change other than paging resets to page 1.
 */
export function buildRequestsHref(
  query: RequestQuery,
  overrides: Partial<RequestQuery> = {},
): string {
  const next: RequestQuery = { ...query, ...overrides };
  if (overrides.page === undefined && Object.keys(overrides).length > 0) {
    next.page = 1;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === '') continue;
    if (value === DEFAULT_QUERY[key as keyof RequestQuery]) continue;
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `/requests?${queryString}` : '/requests';
}

export function hasActiveFilters(query: RequestQuery): boolean {
  return Boolean(
    query.search || query.status || query.priority || query.category || query.assignee,
  );
}
