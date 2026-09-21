import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/app/login/LoginForm';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockClear();
  refresh.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function signIn(email = 'ahmed.faruk@assunnah.test', password = 'Assunnah@2026') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Work email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /Sign in/ }));
}

describe('LoginForm', () => {
  it('submits the credentials and redirects to the requested page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: { id: 'agent-1' } }));
    render(<LoginForm redirectTo="/requests?status=OPEN" />);

    await signIn();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/requests?status=OPEN'));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({
      email: 'ahmed.faruk@assunnah.test',
      password: 'Assunnah@2026',
    });
    // The session cookie arrives on the response, so the server tree must re-render.
    expect(refresh).toHaveBeenCalled();
  });

  it('shows an alert when the credentials are rejected', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } },
        401,
      ),
    );
    render(<LoginForm redirectTo="/requests" />);

    await signIn('ahmed.faruk@assunnah.test', 'wrong-password');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password.'),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('associates field errors with their inputs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Check the highlighted fields and try again.',
            fields: { email: 'Enter a valid email address.' },
          },
        },
        422,
      ),
    );
    render(<LoginForm redirectTo="/requests" />);

    await signIn('not-an-email', 'whatever');

    const email = await screen.findByLabelText('Work email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription('Enter a valid email address.');
  });

  it('reports a network failure without losing the form', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LoginForm redirectTo="/requests" />);

    await signIn();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.'),
    );
    expect(screen.getByRole('button', { name: /Sign in/ })).toBeEnabled();
  });

  it('blocks a second submission while the first is in flight', async () => {
    let resolveRequest: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<LoginForm redirectTo="/requests" />);

    await signIn();

    const button = await screen.findByRole('button', { name: 'Signing in…' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');

    resolveRequest(jsonResponse({ user: { id: 'agent-1' } }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
