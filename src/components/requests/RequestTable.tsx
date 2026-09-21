import Link from 'next/link';

import { formatDate, formatDateTime, formatRelative } from '@/lib/datetime';
import { buildRequestsHref, type RequestQuery, type SortField } from '@/lib/requests/search-params';
import type { ServiceRequestListItem } from '@/types/domain';

import { RequestPriorityBadge, RequestStatusBadge } from './RequestBadges';

const CELL = 'px-3 py-2.5 align-middle';

function SortableHeader({
  field,
  label,
  query,
  className = '',
}: {
  field: SortField;
  label: string;
  query: RequestQuery;
  className?: string;
}) {
  const isActive = query.sort === field;
  const nextDirection = isActive && query.direction === 'desc' ? 'asc' : 'desc';

  return (
    <th
      scope="col"
      aria-sort={isActive ? (query.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${CELL} ${className}`}
    >
      <Link
        href={buildRequestsHref(query, { sort: field, direction: nextDirection })}
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1"
      >
        {label}
        <span aria-hidden="true" className={isActive ? 'text-brand-700' : 'text-transparent'}>
          {isActive && query.direction === 'asc' ? '▲' : '▼'}
        </span>
        {isActive && <span className="sr-only">, sorted {query.direction}ending</span>}
      </Link>
    </th>
  );
}

function AssigneeCell({ assignee }: { assignee: ServiceRequestListItem['assignee'] }) {
  return assignee ? (
    <>{assignee.name}</>
  ) : (
    <span className="text-ink-subtle italic">Unassigned</span>
  );
}

/**
 * Renders one page of results in two layouts: a dense table from `lg` up, and a
 * card list below it — tablet portrait cannot hold this many columns without
 * clipping. Both read the same rows, so there is no second data path to keep in
 * sync.
 */
export function RequestTable({
  requests,
  query,
}: {
  requests: ServiceRequestListItem[];
  query: RequestQuery;
}) {
  return (
    <>
      {/* Columns are revealed progressively — the six that matter from `lg`, then
          requester and category, then created — so no breakpoint shows a table
          wider than its viewport. Below `lg` the card list takes over entirely. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-[0.8125rem]">
          <caption className="sr-only">
            Service requests, sorted by {query.sort} {query.direction}ending
          </caption>
          <thead className="border-line border-b text-xs">
            <tr>
              <th scope="col" className={CELL}>
                Request
              </th>
              <SortableHeader field="subject" label="Subject" query={query} />
              <th scope="col" className={`${CELL} hidden xl:table-cell`}>
                Requester
              </th>
              <th scope="col" className={`${CELL} hidden xl:table-cell`}>
                Category
              </th>
              <SortableHeader field="priority" label="Priority" query={query} />
              <SortableHeader field="status" label="Status" query={query} />
              <th scope="col" className={CELL}>
                Assignee
              </th>
              <SortableHeader
                field="createdAt"
                label="Created"
                query={query}
                className="hidden 2xl:table-cell"
              />
              <SortableHeader field="updatedAt" label="Updated" query={query} />
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-line hover:bg-canvas border-b last:border-0">
                <td className={`${CELL} text-ink-muted font-mono text-xs whitespace-nowrap`}>
                  {request.id}
                </td>
                {/* Every other cell is nowrap, so the subject absorbs the leftover
                    width instead of forcing a minimum that would push the trailing
                    columns out of view on a 1024px laptop. */}
                <td className={CELL}>
                  <Link
                    href={`/requests/${request.id}`}
                    className="text-ink hover:text-brand-700 font-medium underline-offset-2 hover:underline"
                  >
                    {request.subject}
                  </Link>
                </td>
                <td className={`${CELL} text-ink-muted hidden whitespace-nowrap xl:table-cell`}>
                  {request.requester.name}
                </td>
                <td className={`${CELL} text-ink-muted hidden whitespace-nowrap xl:table-cell`}>
                  {request.category}
                </td>
                <td className={CELL}>
                  <RequestPriorityBadge priority={request.priority} />
                </td>
                <td className={CELL}>
                  <RequestStatusBadge status={request.status} />
                </td>
                <td className={`${CELL} text-ink-muted whitespace-nowrap`}>
                  <AssigneeCell assignee={request.assignee} />
                </td>
                <td
                  className={`${CELL} text-ink-muted hidden whitespace-nowrap tabular-nums 2xl:table-cell`}
                >
                  {formatDate(request.createdAt)}
                </td>
                <td className={`${CELL} text-ink-muted whitespace-nowrap`}>
                  <time dateTime={request.updatedAt} title={formatDateTime(request.updatedAt)}>
                    {formatRelative(request.updatedAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-line divide-y lg:hidden">
        {requests.map((request) => (
          <li key={request.id} className="p-3">
            <Link href={`/requests/${request.id}`} className="block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink-subtle font-mono text-xs">{request.id}</span>
                <time dateTime={request.updatedAt} className="text-ink-subtle shrink-0 text-xs">
                  {formatRelative(request.updatedAt)}
                </time>
              </div>
              <p className="text-ink mt-0.5 font-medium">{request.subject}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <RequestStatusBadge status={request.status} />
                <RequestPriorityBadge priority={request.priority} />
                <span className="text-ink-muted text-xs">{request.category}</span>
              </div>
              <p className="text-ink-muted mt-1.5 text-xs">
                {request.requester.name} · <AssigneeCell assignee={request.assignee} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
