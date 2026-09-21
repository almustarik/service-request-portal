import { createHmac, timingSafeEqual } from 'node:crypto';

import type { User } from '@/types/domain';

export interface SessionPayload extends User {
  expiresAt: number;
}

const DEV_SECRET = 'development-only-session-secret-do-not-use-in-production';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16 && !secret.startsWith('replace-me')) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set to a strong value in production.');
  }
  return DEV_SECRET;
}

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const sign = (value: string) => createHmac('sha256', getSecret()).update(value).digest('base64url');

export function createSessionToken(user: User, ttlSeconds: number): string {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Returns the session only when the signature matches and the token is unexpired.
 * Any malformed input resolves to null rather than throwing, because this runs on
 * every request against a value the client controls.
 */
export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.id !== 'string' || typeof payload.expiresAt !== 'number') return null;
    if (payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
