import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/http';
import { devLatency } from '@/lib/dev-latency';
import { getSession } from '@/lib/auth/session';
import { getRequestById, updateRequest } from '@/lib/requests/queries';
import { toFieldErrors, updateRequestSchema } from '@/lib/requests/validation';

/** Request ids are generated server-side in a fixed shape; anything else is
 *  rejected before it reaches the data layer. */
const ID_PATTERN = /^REQ-\d{4,10}$/;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await getSession();
  if (!user) {
    return jsonError(401, 'UNAUTHORIZED', 'Sign in to view this request.');
  }

  await devLatency();

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return jsonError(404, 'NOT_FOUND', 'Request not found.');
  }

  const request = getRequestById(id);
  if (!request) {
    return jsonError(404, 'NOT_FOUND', 'Request not found.');
  }

  return NextResponse.json({ request });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getSession();
  if (!user) {
    return jsonError(401, 'UNAUTHORIZED', 'Sign in to update this request.');
  }

  await devLatency();

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return jsonError(404, 'NOT_FOUND', 'Request not found.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, 'VALIDATION_FAILED', 'The request body must be valid JSON.');
  }

  const parsed = updateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      'VALIDATION_FAILED',
      'That update could not be applied.',
      toFieldErrors(parsed.error),
    );
  }

  const result = updateRequest(id, parsed.data, user);

  if (!result.ok) {
    return result.reason === 'NOT_FOUND'
      ? jsonError(404, 'NOT_FOUND', 'Request not found.')
      : jsonError(422, 'VALIDATION_FAILED', 'That update could not be applied.', {
          assigneeId: 'Select a member of the service desk team.',
        });
  }

  return NextResponse.json({ request: result.request });
}
