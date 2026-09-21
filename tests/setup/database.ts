import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { closeDb } from '@/lib/db/client';
import { seedDatabase } from '@/lib/db/seed';

/**
 * Each worker gets its own seeded SQLite file. DATABASE_PATH is set here, before
 * any test module imports the db client, because the client resolves its path at
 * import time.
 */
const directory = mkdtempSync(join(tmpdir(), 'srp-test-'));
const databasePath = join(directory, 'test.db');

process.env.DATABASE_PATH = databasePath;
process.env.SESSION_SECRET = 'test-session-secret-value-for-vitest';
process.env.API_LATENCY_MS = '0';

const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(join(process.cwd(), 'src', 'lib', 'db', 'schema.sql'), 'utf8'));
seedDatabase(db, { count: 200, now: Date.parse('2026-09-01T00:00:00.000Z') });
db.close();

afterAll(() => {
  closeDb();
  rmSync(directory, { recursive: true, force: true });
});
