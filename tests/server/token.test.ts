import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSessionToken, readSessionToken } from '@/lib/auth/token';
import type { User } from '@/types/domain';

const user: User = { id: 'agent-1', name: 'Ahmed Faruk', email: 'ahmed.faruk@assunnah.test' };

afterEach(() => {
  vi.useRealTimers();
});

describe('session tokens', () => {
  it('round-trips the signed-in user', () => {
    const payload = readSessionToken(createSessionToken(user, 3600));

    expect(payload).toMatchObject(user);
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects a token whose payload has been tampered with', () => {
    const [, signature] = createSessionToken(user, 3600).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...user, id: 'agent-9', expiresAt: Date.now() + 10_000 }),
    ).toString('base64url');

    expect(readSessionToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(user, 3600);

    vi.stubEnv('SESSION_SECRET', 'a-completely-different-secret-value');
    expect(readSessionToken(token)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(user, 60);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(readSessionToken(token)).toBeNull();
  });

  it('rejects malformed input instead of throwing', () => {
    for (const value of [undefined, '', 'nonsense', 'a.b', '....', 'eyJhIjoxfQ']) {
      expect(readSessionToken(value)).toBeNull();
    }
  });
});
