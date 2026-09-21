import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestUpdateForm } from '@/components/requests/RequestUpdateForm';
import type { ServiceRequestDetail, User } from '@/types/domain';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const agents: User[] = [
  { id: 'agent-1', name: 'Ahmed Faruk', email: 'ahmed.faruk@assunnah.test' },
  { id: 'agent-2', name: 'Nusrat Jahan', email: 'nusrat.jahan@assunnah.test' },
];

const request: ServiceRequestDetail = {
  id: 'REQ-10001',
  subject: 'Printer offline in the accounts room',
  description: 'The shared printer has stopped responding.',
  requester: { id: 'user-1', name: 'Habibur Bhuiyan', email: 'habibur@assunnah.test' },
  category: 'IT Support',
  priority: 'HIGH',
  status: 'OPEN',
  assignee: agents[0]!,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-02T08:00:00.000Z',
  activity: [],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const okResponse = (overrides: Partial<ServiceRequestDetail>) =>
  jsonResponse({ request: { ...request, ...overrides } });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

const statusSelect = () => screen.getByLabelText('Status');
const assigneeSelect = () => screen.getByLabelText('Assignee');
const feedback = () => screen.getByRole('status');

function renderForm() {
  return render(<RequestUpdateForm request={request} agents={agents} />);
}

describe('successful updates', () => {
  it('sends only the changed field and confirms the save', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'IN_PROGRESS' }));
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'IN_PROGRESS');

    await waitFor(() => expect(feedback()).toHaveTextContent('Request updated successfully.'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/requests/REQ-10001');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'IN_PROGRESS' });
    expect(statusSelect()).toHaveValue('IN_PROGRESS');
  });

  it('refreshes the server-rendered page so the activity timeline updates', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'RESOLVED' }));
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'RESOLVED');

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('applies the value the server returns rather than the one submitted', async () => {
    // The server is the authority: it may normalise or reject part of a change.
    fetchMock.mockResolvedValue(okResponse({ status: 'CLOSED' }));
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'RESOLVED');

    await waitFor(() => expect(statusSelect()).toHaveValue('CLOSED'));
  });

  it('sends a null assignee when the request is unassigned', async () => {
    fetchMock.mockResolvedValue(okResponse({ assignee: null }));
    renderForm();

    await userEvent.setup().selectOptions(assigneeSelect(), '');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ assigneeId: null });
    expect(assigneeSelect()).toHaveValue('');
  });

  it('changes the assignee', async () => {
    fetchMock.mockResolvedValue(okResponse({ assignee: agents[1]! }));
    renderForm();

    await userEvent.setup().selectOptions(assigneeSelect(), 'agent-2');

    await waitFor(() => expect(assigneeSelect()).toHaveValue('agent-2'));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ assigneeId: 'agent-2' });
  });
});

describe('failed updates', () => {
  it('rolls the control back and explains the failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'VALIDATION_FAILED', message: 'That update could not be applied.' } },
        422,
      ),
    );
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'CLOSED');

    await waitFor(() => expect(feedback()).toHaveTextContent('That update could not be applied.'));
    expect(statusSelect()).toHaveValue('OPEN');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rolls back and reports a lost connection when the request never lands', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm();

    await userEvent.setup().selectOptions(assigneeSelect(), 'agent-2');

    await waitFor(() => expect(feedback()).toHaveTextContent('Could not reach the server.'));
    expect(assigneeSelect()).toHaveValue('agent-1');
  });

  it('prompts the user to sign in again when the session has expired', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sign in to update.' } }, 401),
    );
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'CLOSED');

    await waitFor(() => expect(feedback()).toHaveTextContent('Your session has expired.'));
    expect(statusSelect()).toHaveValue('OPEN');
  });

  it('stays usable after a failure so the change can be retried', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Server error.' } }, 500),
    );
    fetchMock.mockResolvedValueOnce(okResponse({ status: 'IN_PROGRESS' }));
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(statusSelect(), 'IN_PROGRESS');
    await waitFor(() => expect(statusSelect()).toHaveValue('OPEN'));

    await user.selectOptions(statusSelect(), 'IN_PROGRESS');
    await waitFor(() => expect(feedback()).toHaveTextContent('Request updated successfully.'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('duplicate submissions', () => {
  it('disables the controls and shows progress while a save is in flight', async () => {
    let resolveRequest: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderForm();

    await userEvent.setup().selectOptions(statusSelect(), 'IN_PROGRESS');

    await waitFor(() => expect(feedback()).toHaveTextContent('Saving…'));
    expect(statusSelect()).toBeDisabled();
    expect(assigneeSelect()).toBeDisabled();

    resolveRequest(okResponse({ status: 'IN_PROGRESS' }));

    await waitFor(() => expect(statusSelect()).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated changes while a save is pending', async () => {
    let resolveRequest: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderForm();

    const user = userEvent.setup();
    await user.selectOptions(statusSelect(), 'IN_PROGRESS');
    await waitFor(() => expect(statusSelect()).toBeDisabled());

    // A disabled control cannot be changed, so an impatient user cannot queue
    // a second mutation behind the first.
    await user.selectOptions(statusSelect(), 'CLOSED').catch(() => {});
    await user.selectOptions(assigneeSelect(), 'agent-2').catch(() => {});

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRequest(okResponse({ status: 'IN_PROGRESS' }));
    await waitFor(() => expect(statusSelect()).toBeEnabled());
  });
});
