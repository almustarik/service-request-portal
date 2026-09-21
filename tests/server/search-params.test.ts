import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QUERY,
  buildRequestsHref,
  hasActiveFilters,
  parseRequestQuery,
} from '@/lib/requests/search-params';

const parse = (search: string) => parseRequestQuery(new URLSearchParams(search));

describe('parseRequestQuery', () => {
  it('falls back to defaults when nothing is supplied', () => {
    expect(parse('')).toEqual(DEFAULT_QUERY);
  });

  it('reads every supported parameter', () => {
    expect(
      parse(
        'search=printer&status=OPEN&priority=HIGH&category=IT%20Support&assignee=agent-2&sort=createdAt&direction=asc&page=3&pageSize=50',
      ),
    ).toEqual({
      search: 'printer',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'IT Support',
      assignee: 'agent-2',
      sort: 'createdAt',
      direction: 'asc',
      page: 3,
      pageSize: 50,
    });
  });

  it('normalises unknown enum values back to the default instead of failing', () => {
    const query = parse(
      'status=DELETED&priority=BLOCKER&category=Nonsense&sort=hacks&direction=sideways',
    );

    expect(query.status).toBeNull();
    expect(query.priority).toBeNull();
    expect(query.category).toBeNull();
    expect(query.sort).toBe('updatedAt');
    expect(query.direction).toBe('desc');
  });

  it('normalises out-of-range and non-numeric paging values', () => {
    expect(parse('page=0').page).toBe(1);
    expect(parse('page=-5').page).toBe(1);
    expect(parse('page=abc').page).toBe(1);
    expect(parse('pageSize=10000').pageSize).toBe(25);
    expect(parse('pageSize=50').pageSize).toBe(50);
  });

  it('trims the search term and treats an empty value as absent', () => {
    expect(parse('search=%20%20printer%20%20').search).toBe('printer');
    expect(parse('search=').search).toBe('');
  });

  it('accepts a plain searchParams object as well as URLSearchParams', () => {
    expect(parseRequestQuery({ status: 'OPEN', page: '2' })).toMatchObject({
      status: 'OPEN',
      page: 2,
    });
  });

  it('uses the first value when a parameter is repeated', () => {
    expect(parseRequestQuery({ status: ['OPEN', 'CLOSED'] }).status).toBe('OPEN');
  });
});

describe('buildRequestsHref', () => {
  it('omits parameters that are at their default', () => {
    expect(buildRequestsHref(DEFAULT_QUERY)).toBe('/requests');
  });

  it('serialises only the parameters that differ from the default', () => {
    const query = parse('status=OPEN&priority=HIGH&page=2');
    expect(buildRequestsHref(query)).toBe('/requests?status=OPEN&priority=HIGH&page=2');
  });

  it('resets to the first page whenever a filter changes', () => {
    const query = parse('status=OPEN&page=7');
    expect(buildRequestsHref(query, { priority: 'URGENT' })).toBe(
      '/requests?status=OPEN&priority=URGENT',
    );
  });

  it('keeps the page when paging explicitly', () => {
    const query = parse('status=OPEN&page=7');
    expect(buildRequestsHref(query, { page: 8 })).toBe('/requests?status=OPEN&page=8');
  });

  it('drops a filter that is cleared back to null', () => {
    const query = parse('status=OPEN&priority=HIGH');
    expect(buildRequestsHref(query, { status: null })).toBe('/requests?priority=HIGH');
  });

  it('round-trips through parseRequestQuery', () => {
    const query = parse(
      'search=printer&status=OPEN&assignee=agent-2&sort=subject&direction=asc&page=4',
    );
    const href = buildRequestsHref(query);

    expect(parse(href.split('?')[1] ?? '')).toEqual(query);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default query and true once anything is set', () => {
    expect(hasActiveFilters(DEFAULT_QUERY)).toBe(false);
    expect(hasActiveFilters(parse('search=x'))).toBe(true);
    expect(hasActiveFilters(parse('assignee=unassigned'))).toBe(true);
    // Sorting and paging are not filters.
    expect(hasActiveFilters(parse('sort=subject&page=3'))).toBe(false);
  });
});
