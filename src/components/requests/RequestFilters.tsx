'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  DEFAULT_QUERY,
  PAGE_SIZES,
  SORT_DIRECTIONS,
  SORT_FIELDS,
  UNASSIGNED,
  buildRequestsHref,
  hasActiveFilters,
  type RequestQuery,
  type SortField,
} from '@/lib/requests/search-params';
import {
  REQUEST_CATEGORIES,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  type User,
} from '@/types/domain';

import { PRIORITY_LABELS, STATUS_LABELS } from './RequestBadges';

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: 'Last updated',
  createdAt: 'Date created',
  priority: 'Priority',
  status: 'Status',
  subject: 'Subject',
};

const SEARCH_DEBOUNCE_MS = 350;

interface FilterSelectProps<T extends string> {
  id: string;
  label: string;
  value: string;
  options: { value: T; label: string }[];
  placeholder: string;
  onChange: (value: T | null) => void;
  className?: string;
}

/** Generic over its option values so each caller gets back its own union — the
 *  selected value is looked up in `options` rather than cast from the DOM. */
function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  className = '',
}: FilterSelectProps<T>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(options.find((option) => option.value === event.target.value)?.value ?? null)
        }
        className="field-control"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The only stateful piece of the list view. Every control writes the next URL and
 * lets the server re-render; the single exception is the search box, whose input
 * value is held locally so typing stays responsive while the push is debounced.
 */
export function RequestFilters({ query, agents }: { query: RequestQuery; agents: User[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(query.search);
  const isEditingSearch = useRef(false);

  // Back/forward navigation and "Clear filters" change the URL underneath us, so
  // the input follows the URL unless the user is mid-edit.
  useEffect(() => {
    if (!isEditingSearch.current) setSearchTerm(query.search);
  }, [query.search]);

  function navigate(overrides: Partial<RequestQuery>) {
    startTransition(() => router.push(buildRequestsHref(query, overrides)));
  }

  useEffect(() => {
    if (!isEditingSearch.current || searchTerm === query.search) return;

    const timer = setTimeout(() => {
      isEditingSearch.current = false;
      startTransition(() => router.push(buildRequestsHref(query, { search: searchTerm })));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `query` is intentionally read fresh on each keystroke rather than tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  return (
    <section
      aria-labelledby="filters-heading"
      className="border-line bg-surface rounded-lg border p-3 sm:p-4"
    >
      <h2 id="filters-heading" className="sr-only">
        Search and filter requests
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="search" className="field-label">
            Search
          </label>
          <input
            id="search"
            type="search"
            value={searchTerm}
            placeholder="Search by request ID, subject or requester"
            onChange={(event) => {
              isEditingSearch.current = true;
              setSearchTerm(event.target.value);
            }}
            className="field-control"
          />
        </div>

        <FilterSelect
          id="status"
          label="Status"
          value={query.status ?? ''}
          placeholder="All statuses"
          options={REQUEST_STATUSES.map((status) => ({
            value: status,
            label: STATUS_LABELS[status],
          }))}
          onChange={(status) => navigate({ status })}
        />
        <FilterSelect
          id="priority"
          label="Priority"
          value={query.priority ?? ''}
          placeholder="All priorities"
          options={REQUEST_PRIORITIES.map((priority) => ({
            value: priority,
            label: PRIORITY_LABELS[priority],
          }))}
          onChange={(priority) => navigate({ priority })}
        />
        <FilterSelect
          id="category"
          label="Category"
          value={query.category ?? ''}
          placeholder="All categories"
          options={REQUEST_CATEGORIES.map((category) => ({ value: category, label: category }))}
          onChange={(category) => navigate({ category })}
        />
        <FilterSelect
          id="assignee"
          label="Assignee"
          value={query.assignee ?? ''}
          placeholder="Anyone"
          options={[
            { value: UNASSIGNED, label: 'Unassigned' },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
          onChange={(assignee) => navigate({ assignee })}
        />
      </div>

      <div className="border-line mt-3 flex flex-wrap items-end justify-between gap-3 border-t pt-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:flex sm:flex-none sm:items-end">
          {/* Column headers drive sorting from `lg` up, where they are visible; the
              card layout below that has no headers, so it needs these controls. */}
          <FilterSelect
            id="sort"
            label="Sort by"
            value={query.sort}
            placeholder=""
            options={SORT_FIELDS.map((field) => ({ value: field, label: SORT_LABELS[field] }))}
            onChange={(sort) => navigate({ sort: sort ?? DEFAULT_QUERY.sort })}
            className="lg:hidden"
          />
          <FilterSelect
            id="direction"
            label="Order"
            value={query.direction}
            placeholder=""
            options={SORT_DIRECTIONS.map((direction) => ({
              value: direction,
              label: direction === 'desc' ? 'Newest first' : 'Oldest first',
            }))}
            onChange={(direction) => navigate({ direction: direction ?? DEFAULT_QUERY.direction })}
            className="lg:hidden"
          />
          <FilterSelect
            id="pageSize"
            label="Per page"
            value={String(query.pageSize)}
            placeholder=""
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(size) => navigate({ pageSize: Number(size) })}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite" className="text-ink-subtle text-xs">
            {isPending ? 'Updating results…' : ''}
          </span>
          {hasActiveFilters(query) && (
            <Link
              href="/requests"
              onClick={() => {
                isEditingSearch.current = false;
                setSearchTerm('');
              }}
              className="text-brand-700 text-[0.8125rem] font-medium underline underline-offset-2"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
