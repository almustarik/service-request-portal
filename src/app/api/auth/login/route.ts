import { NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonError } from '@/lib/api/http';
import { devLatency } from '@/lib/dev-latency';
import { authenticate, startSession } from '@/lib/auth/session';
import { toFieldErrors } from '@/lib/requests/validation';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export async function POST(request: Request) {
  await devLatency();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, 'VALIDATION_FAILED', 'The request body must be valid JSON.');
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      'VALIDATION_FAILED',
      'Check the highlighted fields and try again.',
      toFieldErrors(parsed.error),
    );
  }

  const user = authenticate(parsed.data.email, parsed.data.password);
  // Deliberately identical for unknown emails and wrong passwords so the
  // response cannot be used to enumerate staff accounts.
  if (!user) {
    return jsonError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  await startSession(user);
  return NextResponse.json({ user });
}
