import { RequestTableSkeleton } from '@/components/requests/RequestTableSkeleton';

export default function RequestsLoading() {
  return (
    <div className="mx-auto max-w-[110rem] space-y-4">
      <div>
        <h1 className="text-ink text-xl font-semibold">Service requests</h1>
        <p className="text-ink-muted mt-0.5 text-[0.8125rem]">
          Track and update requests raised by staff across the foundation.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="border-line bg-surface h-40 animate-pulse rounded-lg border"
      />
      <div className="border-line bg-surface overflow-hidden rounded-lg border">
        <RequestTableSkeleton />
      </div>
    </div>
  );
}
