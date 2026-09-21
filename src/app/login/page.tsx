import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

/** Only in-app paths are accepted, so `?next=` cannot be used as an open redirect. */
function safeRedirectTarget(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/requests';
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectTarget(next);

  if (await getSession()) {
    redirect(redirectTo);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-ink text-lg font-semibold">As-Sunnah Foundation</h1>
          <p className="text-ink-muted text-sm">Service Desk — staff sign in</p>
        </div>

        <div className="border-line bg-surface rounded-lg border p-5 shadow-xs">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="text-ink-subtle mt-4 text-xs">
          Demo credentials are listed in the project README.
        </p>
      </main>
    </div>
  );
}
