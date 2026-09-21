import type { Metadata } from 'next';

import { summarizeActivitiesByAssignee } from '@/lib/activity/summarize';
import { requireSession } from '@/lib/auth/session';
import { formatDuration } from '@/lib/datetime';
import { listAgents, listAllActivity } from '@/lib/requests/queries';

export const metadata: Metadata = { title: 'Team performance' };
export const dynamic = 'force-dynamic';

const CELL = 'px-3 py-2.5';

export default async function PerformancePage() {
  await requireSession();

  const agents = listAgents();
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const summaries = summarizeActivitiesByAssignee(listAllActivity());

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-ink text-xl font-semibold">Team performance</h1>
        <p className="text-ink-muted mt-0.5 text-[0.8125rem]">
          Workload and resolution times derived from the full request activity log.
        </p>
      </div>

      <div className="border-line bg-surface overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-[0.8125rem]">
          <caption className="sr-only">
            Assigned, resolved and average resolution time per staff member
          </caption>
          <thead className="border-line text-ink-muted border-b text-xs">
            <tr>
              <th scope="col" className={CELL}>
                Staff member
              </th>
              <th scope="col" className={`${CELL} text-right`}>
                Assigned
              </th>
              <th scope="col" className={`${CELL} text-right`}>
                Resolved
              </th>
              <th scope="col" className={`${CELL} hidden text-right sm:table-cell`}>
                Resolution rate
              </th>
              <th scope="col" className={`${CELL} text-right`}>
                Avg. resolution
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.assigneeId} className="border-line border-b last:border-0">
                <th scope="row" className={`${CELL} text-ink font-medium`}>
                  {names.get(summary.assigneeId) ?? summary.assigneeId}
                </th>
                <td className={`${CELL} text-ink-muted text-right tabular-nums`}>
                  {summary.totalAssigned.toLocaleString()}
                </td>
                <td className={`${CELL} text-ink-muted text-right tabular-nums`}>
                  {summary.totalResolved.toLocaleString()}
                </td>
                <td
                  className={`${CELL} text-ink-muted hidden text-right tabular-nums sm:table-cell`}
                >
                  {summary.totalAssigned === 0
                    ? '—'
                    : `${Math.round((summary.totalResolved / summary.totalAssigned) * 100)}%`}
                </td>
                <td className={`${CELL} text-ink-muted text-right tabular-nums`}>
                  {formatDuration(summary.averageResolutionTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-subtle text-xs">
        Resolution time measures the gap between a request being assigned and first being marked
        resolved. Requests that were reassigned are credited to whoever held them at resolution.
      </p>
    </div>
  );
}
