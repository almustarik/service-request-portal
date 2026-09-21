import Link from 'next/link';

import { buildRequestsHref, type RequestQuery } from '@/lib/requests/search-params';
import type { PaginatedResponse } from '@/types/domain';

type Pagination = PaginatedResponse<unknown>['pagination'];

const LINK_BASE =
  'inline-flex items-center rounded-md border px-2.5 py-1.5 text-[0.8125rem] font-medium';

/** Compact window around the current page: 1 … 4 5 6 … 400. */
function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return visible.flatMap((value, index) => {
    const previous = visible[index - 1];
    return previous !== undefined && value - previous > 1 ? ['gap' as const, value] : [value];
  });
}

export function RequestPagination({
  pagination,
  query,
}: {
  pagination: Pagination;
  query: RequestQuery;
}) {
  const { page, pageSize, total, totalPages } = pagination;
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="border-line flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3"
    >
      <p className="text-ink-muted text-xs tabular-nums">
        Showing <strong className="text-ink font-semibold">{firstRow.toLocaleString()}</strong>–
        <strong className="text-ink font-semibold">{lastRow.toLocaleString()}</strong> of{' '}
        <strong className="text-ink font-semibold">{total.toLocaleString()}</strong> requests
      </p>

      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={buildRequestsHref(query, { page: page - 1 })}
              rel="prev"
              className={`${LINK_BASE} border-line-strong bg-surface text-ink hover:bg-canvas`}
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={`${LINK_BASE} border-line text-ink-subtle`}>
              Previous
            </span>
          )}
        </li>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="text-ink-subtle px-1 text-xs">
              …
            </li>
          ) : (
            <li key={entry} className="hidden sm:block">
              <Link
                href={buildRequestsHref(query, { page: entry })}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
                className={`${LINK_BASE} tabular-nums ${
                  entry === page
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line-strong bg-surface text-ink hover:bg-canvas'
                }`}
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li className="sm:hidden">
          <span className="text-ink-muted px-1 text-xs tabular-nums">
            Page {page} of {totalPages}
          </span>
        </li>

        <li>
          {page < totalPages ? (
            <Link
              href={buildRequestsHref(query, { page: page + 1 })}
              rel="next"
              className={`${LINK_BASE} border-line-strong bg-surface text-ink hover:bg-canvas`}
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className={`${LINK_BASE} border-line text-ink-subtle`}>
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
