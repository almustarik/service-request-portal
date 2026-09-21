'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import type { ApiErrorBody } from '@/lib/api/http';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        }),
      });

      if (response.ok) {
        // The session cookie is set by the response, so a refresh is needed for
        // the server to re-render the protected layout with the new session.
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      setError(body?.error.message ?? 'Sign in failed. Please try again.');
      setFieldErrors(body?.error.fields ?? {});
      setIsSubmitting(false);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && (
        <p
          role="alert"
          className="border-danger-200 bg-danger-50 text-danger-700 rounded-md border px-3 py-2 text-[0.8125rem]"
        >
          {error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="field-label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          aria-invalid={Boolean(fieldErrors.email) || undefined}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          className="field-control"
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-danger-700 mt-1 text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors.password) || undefined}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          className="field-control"
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-danger-700 mt-1 text-xs">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" pending={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
