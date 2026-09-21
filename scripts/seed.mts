/**
 * Rebuilds data/app.db from scratch. Run with `npm run seed`.
 * The app also seeds automatically the first time it connects to an empty file,
 * so this script is only needed to reset an existing database.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { REQUEST_COUNT, seedDatabase } from '../src/lib/db/seed.ts';

const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'app.db');

for (const suffix of ['', '-wal', '-shm']) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(join(process.cwd(), 'src', 'lib', 'db', 'schema.sql'), 'utf8'));

const startedAt = Date.now();
seedDatabase(db);

const { activities } = db.prepare('SELECT COUNT(*) AS activities FROM activity').get() as {
  activities: number;
};
db.close();

console.log(
  `Seeded ${REQUEST_COUNT.toLocaleString()} requests and ${activities.toLocaleString()} activity records ` +
    `into ${dbPath} in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
);
