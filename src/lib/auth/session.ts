import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db/client';
import type { User } from '@/types/domain';

import { verifyPassword } from './password';
import { createSessionToken, readSessionToken } from './token';

export const SESSION_COOKIE = 'srp_session';

const ttlSeconds = () => Number(process.env.SESSION_TTL_SECONDS ?? 8 * 60 * 60);

export function authenticate(email: string, password: string): User | null {
  const row = getDb()
    .prepare('SELECT id, name, email, password_hash FROM users WHERE email = ? AND is_agent = 1')
    .get(email.trim().toLowerCase()) as
    { id: string; name: string; email: string; password_hash: string | null } | undefined;

  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, name: row.name, email: row.email };
}

export async function startSession(user: User): Promise<void> {
  const ttl = ttlSeconds();
  const store = await cookies();

  store.set(SESSION_COOKIE, createSessionToken(user, ttl), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttl,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<User | null> {
  const payload = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return payload && { id: payload.id, name: payload.name, email: payload.email };
}

/**
 * Page-level guard. Every protected page calls this on the server, so protection
 * never depends on the middleware redirect alone.
 */
export async function requireSession(returnTo?: string): Promise<User> {
  const user = await getSession();
  if (user) return user;

  const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
  redirect(target);
}
