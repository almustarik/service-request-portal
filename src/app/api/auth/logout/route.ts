import { NextResponse } from 'next/server';

import { endSession } from '@/lib/auth/session';

/** Called by the sign-out form, so it answers with a redirect the browser can
 *  follow natively rather than a JSON body. */
export async function POST(request: Request) {
  await endSession();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
