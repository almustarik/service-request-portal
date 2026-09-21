import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RequestActivityTimeline } from '@/components/requests/RequestActivityTimeline';
import { RequestPagination } from '@/components/requests/RequestPagination';
import { RequestTable } from '@/components/requests/RequestTable';
import { DEFAULT_QUERY, type RequestQuery } from '@/lib/requests/search-params';
import type { Activity, ServiceRequestListItem } from '@/types/domain';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const query = (overrides: Partial<RequestQuery> = {}): RequestQuery => ({
  ...DEFAULT_QUERY,
  ...overrides,
});

const requests: ServiceRequestListItem[] = [
  {
    id: 'REQ-10001',
    subject: 'Printer offline in the accounts room',
    requester: { id: 'user-1', name: 'Habibur Bhuiyan' },
    category: 'IT Support',
    priority: 'URGENT',
    status: 'OPEN',
    assignee: { id: 'agent-1', name: 'Ahmed Faruk' },
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
  },
  {
    id: 'REQ-10002',
    subject: 'Lift out of service at Mirpur Branch',
    requester: { id: 'user-2', name: 'Sadia Karim' },
    category: 'Facilities',
    priority: 'LOW',
    status: 'RESOLVED',
    assignee: null,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
  },
];

describe('RequestTable', () => {
  it('links every request to its detail page', () => {
    render(<RequestTable requests={requests} query={query()} />);

    const link = within(screen.getByRole('table')).getByRole('link', {
      name: 'Printer offline in the accounts room',
    });
    expect(link).toHaveAttribute('href', '/requests/REQ-10001');
  });

  it('labels status and priority in text, not colour alone', () => {
    render(<RequestTable requests={requests} query={query()} />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!;

    expect(within(row).getByText('Open')).toBeInTheDocument();
    expect(within(row).getByText('Urgent')).toBeInTheDocument();
  });

  it('marks an unassigned request explicitly', () => {
    render(<RequestTable requests={requests} query={query()} />);

    expect(within(screen.getByRole('table')).getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('exposes the active sort to assistive technology', () => {
    render(
      <RequestTable requests={requests} query={query({ sort: 'priority', direction: 'asc' })} />,
    );

    const header = screen.getByRole('columnheader', { name: /Priority/ });
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Subject/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('toggles direction when the active sort column is clicked again', () => {
    render(
      <RequestTable requests={requests} query={query({ sort: 'updatedAt', direction: 'desc' })} />,
    );

    const header = screen.getByRole('columnheader', { name: /Updated/ });
    expect(within(header).getByRole('link')).toHaveAttribute('href', '/requests?direction=asc');
  });

  it('starts a new column descending and preserves active filters', () => {
    render(<RequestTable requests={requests} query={query({ status: 'OPEN', page: 3 })} />);

    const header = screen.getByRole('columnheader', { name: /Subject/ });
    expect(within(header).getByRole('link')).toHaveAttribute(
      'href',
      '/requests?status=OPEN&sort=subject',
    );
  });

  it('renders a card list alongside the table, switching at the lg breakpoint', () => {
    render(<RequestTable requests={requests} query={query()} />);

    // Both layouts are rendered from the same rows and CSS hides one, which also
    // removes it from the accessibility tree in a real browser. The dense table
    // only appears from `lg`; tablet portrait and below get the cards.
    expect(screen.getAllByRole('link', { name: /Printer offline/ })).toHaveLength(2);
    expect(screen.getAllByText('REQ-10001')).toHaveLength(2);
    expect(screen.getByRole('table').parentElement).toHaveClass('lg:block');
    expect(screen.getByRole('list')).toHaveClass('lg:hidden');
  });
});

describe('RequestPagination', () => {
  const pagination = { page: 5, pageSize: 25, total: 10_000, totalPages: 400 };

  it('reports the visible range and total', () => {
    render(<RequestPagination pagination={pagination} query={query({ page: 5 })} />);

    const summary = screen.getByText(/Showing/);
    expect(summary).toHaveTextContent('101');
    expect(summary).toHaveTextContent('125');
    expect(summary).toHaveTextContent('10,000');
  });

  it('links to the neighbouring pages and marks the current one', () => {
    render(<RequestPagination pagination={pagination} query={query({ page: 5 })} />);

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/requests?page=4',
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/requests?page=6');
    expect(screen.getByRole('link', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page');
  });

  it('always offers the first and last page without listing all 400', () => {
    render(<RequestPagination pagination={pagination} query={query({ page: 5 })} />);

    expect(screen.getByRole('link', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 400' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Page/ }).length).toBeLessThan(10);
  });

  it('does not offer a previous page on the first page', () => {
    render(
      <RequestPagination pagination={{ ...pagination, page: 1 }} query={query({ page: 1 })} />,
    );

    expect(screen.queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.getByText('Previous')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not offer a next page on the last page', () => {
    render(
      <RequestPagination pagination={{ ...pagination, page: 400 }} query={query({ page: 400 })} />,
    );

    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('carries the active filters into every page link', () => {
    render(
      <RequestPagination
        pagination={{ ...pagination, page: 2, totalPages: 4, total: 100 }}
        query={query({ page: 2, status: 'OPEN', search: 'printer' })}
      />,
    );

    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/requests?search=printer&status=OPEN&page=3',
    );
  });
});

describe('RequestActivityTimeline', () => {
  const names = new Map([
    ['agent-1', 'Ahmed Faruk'],
    ['agent-2', 'Nusrat Jahan'],
  ]);

  const entry = (overrides: Partial<Activity>): Activity => ({
    id: 'act-1',
    requestId: 'REQ-10001',
    type: 'CREATED',
    actorId: 'user-1',
    actorName: 'Habibur Bhuiyan',
    createdAt: '2026-09-01T08:00:00.000Z',
    previousValue: null,
    newValue: null,
    ...overrides,
  });

  it('describes a status change with readable labels', () => {
    render(
      <RequestActivityTimeline
        activity={[
          entry({
            id: 'a',
            type: 'STATUS_CHANGED',
            actorName: 'Ahmed Faruk',
            previousValue: 'OPEN',
            newValue: 'IN_PROGRESS',
          }),
        ]}
        userNames={names}
      />,
    );

    expect(screen.getByText('Ahmed Faruk')).toBeInTheDocument();
    expect(screen.getByText('Open → In progress')).toBeInTheDocument();
  });

  it('resolves assignee ids to names', () => {
    render(
      <RequestActivityTimeline
        activity={[
          entry({ id: 'a', type: 'ASSIGNEE_CHANGED', newValue: 'agent-1' }),
          entry({
            id: 'b',
            type: 'ASSIGNEE_CHANGED',
            previousValue: 'agent-1',
            newValue: 'agent-2',
          }),
        ]}
        userNames={names}
      />,
    );

    expect(screen.getByText('Assigned to Ahmed Faruk')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Faruk → Nusrat Jahan')).toBeInTheDocument();
  });

  it('renders incomplete records without crashing', () => {
    render(
      <RequestActivityTimeline
        activity={[
          entry({ id: 'a', type: 'STATUS_CHANGED', previousValue: null, newValue: null }),
          entry({ id: 'b', type: 'ASSIGNEE_CHANGED', newValue: 'agent-unknown' }),
          entry({ id: 'c', type: 'ASSIGNEE_CHANGED', newValue: null }),
          entry({ id: 'd', actorName: '', createdAt: 'not-a-date' }),
          entry({ id: 'e', type: 'ARCHIVED' as Activity['type'] }),
        ]}
        userNames={names}
      />,
    );

    expect(screen.getByText('Unknown → Unknown')).toBeInTheDocument();
    expect(screen.getByText('Assigned to an unknown user')).toBeInTheDocument();
    expect(screen.getByText(/removed the assignee/)).toBeInTheDocument();
    expect(screen.getByText('Unknown user')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.getByText(/updated this request/)).toBeInTheDocument();
  });

  it('explains an empty timeline', () => {
    render(<RequestActivityTimeline activity={[]} userNames={names} />);

    expect(screen.getByText('No activity has been recorded yet.')).toBeInTheDocument();
  });
});
