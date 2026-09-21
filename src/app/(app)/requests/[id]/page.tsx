import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RequestActivityTimeline } from '@/components/requests/RequestActivityTimeline';
import { RequestPriorityBadge, RequestStatusBadge } from '@/components/requests/RequestBadges';
import { RequestUpdateForm } from '@/components/requests/RequestUpdateForm';
import { requireSession } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/datetime';
import { getRequestById, listAgents } from '@/lib/requests/queries';

// Reads the session cookie and live data, so it must never be prerendered.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const request = getRequestById(id);
  return { title: request ? `${request.id} — ${request.subject}` : 'Request not found' };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-ink-muted shrink-0 text-xs font-medium">{label}</dt>
      <dd className="text-ink min-w-0 text-right text-[0.8125rem]">{children}</dd>
    </div>
  );
}

export default async function RequestDetailPage({ params }: PageProps) {
  await requireSession();

  const { id } = await params;
  const request = getRequestById(id);
  if (!request) notFound();

  const agents = listAgents();
  const userNames = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/requests"
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-[0.8125rem]"
      >
        <span aria-hidden="true">←</span> Back to service requests
      </Link>

      <header>
        <p className="text-ink-subtle font-mono text-xs">{request.id}</p>
        <h1 className="text-ink mt-0.5 text-xl font-semibold text-balance">{request.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
          <span className="text-ink-muted text-xs">
            Raised by {request.requester.name} · {formatDateTime(request.createdAt)}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start">
        <div className="space-y-4 lg:order-1">
          <section
            aria-labelledby="description-heading"
            className="border-line bg-surface rounded-lg border p-4"
          >
            <h2 id="description-heading" className="text-ink text-[0.8125rem] font-semibold">
              Description
            </h2>
            <p className="text-ink-muted mt-2 text-[0.8125rem] leading-relaxed whitespace-pre-line">
              {request.description}
            </p>
          </section>

          <section
            aria-labelledby="activity-heading"
            className="border-line bg-surface rounded-lg border p-4"
          >
            <h2 id="activity-heading" className="text-ink mb-3 text-[0.8125rem] font-semibold">
              Activity
            </h2>
            <RequestActivityTimeline activity={request.activity} userNames={userNames} />
          </section>
        </div>

        <aside className="space-y-4 lg:order-2">
          <section
            aria-labelledby="update-heading"
            className="border-line bg-surface rounded-lg border p-4"
          >
            <h2 id="update-heading" className="text-ink mb-3 text-[0.8125rem] font-semibold">
              Update request
            </h2>
            <RequestUpdateForm request={request} agents={agents} />
          </section>

          <section
            aria-labelledby="details-heading"
            className="border-line bg-surface rounded-lg border p-4"
          >
            <h2 id="details-heading" className="text-ink text-[0.8125rem] font-semibold">
              Details
            </h2>
            <dl className="divide-line mt-1 divide-y">
              <DetailRow label="Category">{request.category}</DetailRow>
              <DetailRow label="Requester">
                <span className="block">{request.requester.name}</span>
                <span className="text-ink-subtle block text-xs break-all">
                  {request.requester.email}
                </span>
              </DetailRow>
              <DetailRow label="Assignee">
                {request.assignee?.name ?? (
                  <span className="text-ink-subtle italic">Unassigned</span>
                )}
              </DetailRow>
              <DetailRow label="Created">{formatDateTime(request.createdAt)}</DetailRow>
              <DetailRow label="Last updated">{formatDateTime(request.updatedAt)}</DetailRow>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
