import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RequestFilters } from '@/components/requests/RequestFilters';
import { RequestPagination } from '@/components/requests/RequestPagination';
import { RequestTable } from '@/components/requests/RequestTable';
import { RequestTableSkeleton } from '@/components/requests/RequestTableSkeleton';
import { devLatency } from '@/lib/dev-latency';
import { requireSession } from '@/lib/auth/session';
import { listAgents, queryRequests } from '@/lib/requests/queries';
import {
  hasActiveFilters,
  parseRequestQuery,
  type RequestQuery,
} from '@/lib/requests/search-params';

export const metadata: Metadata = { title: 'Service requests' };

// Reads the session cookie and live data, so it must never be prerendered.
export const dynamic = 'force-dynamic';

async function RequestResults({ query }: { query: RequestQuery }) {
  await devLatency();
  const { data, pagination } = queryRequests(query);

  if (data.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-ink font-medium">No requests found.</p>
        <p className="text-ink-muted mt-1 text-[0.8125rem]">
          {hasActiveFilters(query)
            ? 'Try changing your search or filters.'
            : 'There are no service requests in the system yet.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <RequestTable requests={data} query={query} />
      <RequestPagination pagination={pagination} query={query} />
    </>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout guards this route too, but layouts and pages render in parallel,
  // so the page checks the session before it reads any data.
  await requireSession();

  const query = parseRequestQuery(await searchParams);
  const agents = listAgents();

  return (
    <div className="mx-auto max-w-[110rem] space-y-4">
      <div>
        <h1 className="text-ink text-xl font-semibold">Service requests</h1>
        <p className="text-ink-muted mt-0.5 text-[0.8125rem]">
          Track and update requests raised by staff across the foundation.
        </p>
      </div>

      <RequestFilters query={query} agents={agents} />

      <div className="border-line bg-surface overflow-hidden rounded-lg border">
        {/* Keyed on the query so a filter change swaps in the skeleton while the
            server renders the next page of results. */}
        <Suspense
          key={JSON.stringify(query)}
          fallback={<RequestTableSkeleton rows={query.pageSize} />}
        >
          <RequestResults query={query} />
        </Suspense>
      </div>
    </div>
  );
}
