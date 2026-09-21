import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestFilters } from '@/components/requests/RequestFilters';
import { DEFAULT_QUERY, parseRequestQuery, type RequestQuery } from '@/lib/requests/search-params';
import type { User } from '@/types/domain';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const agents: User[] = [
  { id: 'agent-1', name: 'Ahmed Faruk', email: 'ahmed.faruk@assunnah.test' },
  { id: 'agent-2', name: 'Nusrat Jahan', email: 'nusrat.jahan@assunnah.test' },
];

function renderFilters(query: Partial<RequestQuery> = {}) {
  return render(<RequestFilters query={{ ...DEFAULT_QUERY, ...query }} agents={agents} />);
}

/** Mimics typing into the controlled search box one character at a time.
 *  `fireEvent` is used rather than `userEvent` because these tests drive the
 *  debounce with fake timers, which userEvent's own internal delays deadlock on. */
function typeSearch(text: string) {
  const input = screen.getByLabelText('Search');
  for (let length = 1; length <= text.length; length += 1) {
    fireEvent.change(input, { target: { value: text.slice(0, length) } });
  }
}

beforeEach(() => {
  push.mockClear();
});

describe('search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces typing into a single navigation', async () => {
    renderFilters();

    typeSearch('printer');
    expect(push).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/requests?search=printer');
  });

  it('restarts the delay while the user is still typing', async () => {
    renderFilters();

    typeSearch('prin');
    await vi.advanceTimersByTimeAsync(200);
    typeSearch('printer');
    await vi.advanceTimersByTimeAsync(200);

    expect(push).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/requests?search=printer');
  });

  it('keeps existing filters and resets to the first page', async () => {
    renderFilters({ status: 'OPEN', page: 5 });

    typeSearch('lift');
    await vi.advanceTimersByTimeAsync(400);

    expect(push).toHaveBeenCalledWith('/requests?search=lift&status=OPEN');
  });

  it('clears the search when the box is emptied', async () => {
    renderFilters({ search: 'printer' });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(400);

    expect(push).toHaveBeenCalledWith('/requests');
  });
});

describe('filters', () => {
  const user = () => userEvent.setup();

  it('shows the search term from the URL', () => {
    renderFilters({ search: 'generator' });

    expect(screen.getByLabelText('Search')).toHaveValue('generator');
  });

  it('navigates immediately when a status is chosen', async () => {
    renderFilters();

    await user().selectOptions(screen.getByLabelText('Status'), 'OPEN');

    expect(push).toHaveBeenCalledWith('/requests?status=OPEN');
  });

  it('combines filters instead of replacing them', async () => {
    renderFilters({ status: 'OPEN', search: 'printer' });

    await user().selectOptions(screen.getByLabelText('Priority'), 'HIGH');

    expect(push).toHaveBeenCalledWith('/requests?search=printer&status=OPEN&priority=HIGH');
  });

  it('offers an unassigned option alongside each agent', async () => {
    renderFilters();

    await user().selectOptions(screen.getByLabelText('Assignee'), 'unassigned');
    expect(push).toHaveBeenLastCalledWith('/requests?assignee=unassigned');

    await user().selectOptions(screen.getByLabelText('Assignee'), 'agent-2');
    expect(push).toHaveBeenLastCalledWith('/requests?assignee=agent-2');
  });

  it('clears a filter when the placeholder option is selected', async () => {
    renderFilters({ status: 'OPEN', priority: 'HIGH' });

    await user().selectOptions(screen.getByLabelText('Status'), '');

    expect(push).toHaveBeenCalledWith('/requests?priority=HIGH');
  });

  it('resets to the first page when the page size changes', async () => {
    renderFilters({ page: 4 });

    await user().selectOptions(screen.getByLabelText('Per page'), '50');

    expect(push).toHaveBeenCalledWith('/requests?pageSize=50');
  });

  it('produces a URL the server parses back to the same query', async () => {
    renderFilters({ status: 'OPEN' });

    await user().selectOptions(screen.getByLabelText('Category'), 'IT Support');

    const href = push.mock.calls.at(-1)?.[0] as string;
    expect(parseRequestQuery(new URLSearchParams(href.split('?')[1]))).toMatchObject({
      status: 'OPEN',
      category: 'IT Support',
      page: 1,
    });
  });
});

describe('clear filters', () => {
  it('appears only when a filter is active and resets the whole query', async () => {
    const { rerender } = renderFilters();
    expect(screen.queryByRole('link', { name: 'Clear filters' })).not.toBeInTheDocument();

    rerender(
      <RequestFilters
        query={{ ...DEFAULT_QUERY, search: 'printer', status: 'OPEN' }}
        agents={agents}
      />,
    );

    const clear = screen.getByRole('link', { name: 'Clear filters' });
    expect(clear).toHaveAttribute('href', '/requests');

    await userEvent.setup().click(clear);
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('stays hidden when only sorting and paging are set', () => {
    renderFilters({ sort: 'subject', page: 3 });

    expect(screen.queryByRole('link', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});
