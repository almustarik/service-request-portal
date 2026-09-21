import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/* Modules under lib/db are imported both by the bundled Next app and directly by
 * `scripts/seed.mts` under Node's TypeScript stripping, which requires explicit
 * file extensions on relative imports. */
import { seedDatabase } from './seed.ts';

/* Resolved on first connection rather than at import time, so a test harness can
 * point DATABASE_PATH at a temporary file before the first query runs. */
const databasePath = () => process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'app.db');
const schemaPath = () => join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');

/* Next's dev server re-evaluates modules on every hot reload. Caching the handle
 * on globalThis keeps a single SQLite connection instead of leaking one per edit. */
const globalForDb = globalThis as typeof globalThis & { __servicePortalDb?: DatabaseSync };

function connect(): DatabaseSync {
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });

  const database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(readFileSync(schemaPath(), 'utf8'));

  const { count } = database.prepare('SELECT COUNT(*) AS count FROM requests').get() as {
    count: number;
  };
  if (count === 0) {
    seedDatabase(database);
  }

  return database;
}

export function getDb(): DatabaseSync {
  globalForDb.__servicePortalDb ??= connect();
  return globalForDb.__servicePortalDb;
}

/** Releases the file handle. Only the test suite needs this; the dev server and
 *  production process hold the connection for their lifetime. */
export function closeDb(): void {
  globalForDb.__servicePortalDb?.close();
  globalForDb.__servicePortalDb = undefined;
}
