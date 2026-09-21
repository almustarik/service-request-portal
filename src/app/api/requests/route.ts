import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/api/http';
import { devLatency } from '@/lib/dev-latency';
import { getSession } from '@/lib/auth/session';
import { queryRequests } from '@/lib/requests/queries';
import { parseRequestQuery } from '@/lib/requests/search-params';

/**
 * The list page reads the data layer directly during its server render, so this
 * handler exists for external/API consumers rather than to serve the UI. Both
 * paths share `parseRequestQuery` and `queryRequests`, so filtering, sorting and
 * pagination behave identically.
 */
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return jsonError(401, 'UNAUTHORIZED', 'Sign in to view service requests.');
  }

  await devLatency();

  const query = parseRequestQuery(new URL(request.url).searchParams);
  return NextResponse.json(queryRequests(query));
}
