import type { DatabaseSync } from 'node:sqlite';

import { hashPassword } from '../auth/password.ts';
import {
  AGENTS,
  COMMENTS,
  DESCRIPTION_CLOSERS,
  DESCRIPTION_DETAILS,
  DESCRIPTION_OPENERS,
  DISTRICTS,
  FIRST_NAMES,
  ITEMS,
  LAST_NAMES,
  OFFICES,
  PROGRAMMES,
  ROLES,
  ROOMS,
  SUBJECT_TEMPLATES,
  SYSTEMS,
  TEAMS,
  VENDORS,
} from './seed-content.ts';

export const REQUEST_COUNT = 10_000;
const REQUESTER_COUNT = 240;

/** Shared password for every seeded staff account; documented in the README. */
const DEMO_PASSWORD = 'Assunnah@2026';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const OLDEST_REQUEST_AGE = 540 * DAY;

const STATUS_CHAIN = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

/** mulberry32 — small, fast, and reproducible, so a reseed always produces the
 *  same dataset for a given seed value. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = ReturnType<typeof createRandom>;

const pick = <T>(random: Random, values: readonly T[]): T =>
  values[Math.floor(random() * values.length)]!;

const between = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

/** Picks an index from a weighted distribution, e.g. [25, 40, 25, 10]. */
function weightedIndex(random: Random, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    threshold -= weights[i]!;
    if (threshold <= 0) return i;
  }
  return weights.length - 1;
}

function fillTemplate(random: Random, template: string): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    switch (token) {
      case 'office':
        return pick(random, OFFICES);
      case 'room':
        return pick(random, ROOMS);
      case 'district':
        return pick(random, DISTRICTS);
      case 'programme':
        return pick(random, PROGRAMMES);
      case 'team':
        return pick(random, TEAMS);
      case 'system':
        return pick(random, SYSTEMS);
      case 'vendor':
        return pick(random, VENDORS);
      case 'item':
        return pick(random, ITEMS);
      case 'role':
        return pick(random, ROLES);
      default:
        return token;
    }
  });
}

interface SeedActivity {
  type: string;
  at: number;
  previousValue: string | null;
  newValue: string | null;
  actorId: string;
  actorName: string;
}

export interface SeedOptions {
  now?: number;
  seed?: number;
  /** Smaller datasets keep the test suite fast; the app always seeds the full set. */
  count?: number;
}

export function seedDatabase(db: DatabaseSync, options: SeedOptions = {}): void {
  const { now = Date.now(), seed = 20260921, count = REQUEST_COUNT } = options;
  const random = createRandom(seed);
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const agents = AGENTS.map((agent, index) => ({
    id: `agent-${index + 1}`,
    ...agent,
  }));

  const requesters = Array.from({ length: REQUESTER_COUNT }, (_, index) => {
    const first = pick(random, FIRST_NAMES);
    const last = pick(random, LAST_NAMES);
    return {
      id: `user-${index + 1}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index + 1}@assunnah.test`,
    };
  });

  const categories = Object.keys(SUBJECT_TEMPLATES);

  const insertUser = db.prepare(
    'INSERT INTO users (id, name, email, password_hash, is_agent) VALUES (?, ?, ?, ?, ?)',
  );
  const insertRequest = db.prepare(
    `INSERT INTO requests
       (id, subject, description, requester_id, requester_name, category, priority, status, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertActivity = db.prepare(
    `INSERT INTO activity
       (id, request_id, type, actor_id, actor_name, created_at, previous_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');
  try {
    for (const agent of agents) {
      insertUser.run(agent.id, agent.name, agent.email, passwordHash, 1);
    }
    for (const requester of requesters) {
      insertUser.run(requester.id, requester.name, requester.email, null, 0);
    }

    for (let index = 0; index < count; index += 1) {
      const id = `REQ-${10_000 + index}`;
      const category = pick(random, categories);
      const subject = fillTemplate(random, pick(random, SUBJECT_TEMPLATES[category]!));
      const description = [
        fillTemplate(random, pick(random, DESCRIPTION_OPENERS)),
        pick(random, DESCRIPTION_DETAILS),
        pick(random, DESCRIPTION_CLOSERS),
      ].join(' ');

      const priority = (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[
        weightedIndex(random, [25, 40, 25, 10])
      ]!;
      const requester = pick(random, requesters);

      // A request only moves past OPEN once somebody owns it; the small share of
      // unassigned-but-closed rows stands in for withdrawn or duplicate tickets.
      const isAssigned = random() < 0.85;
      const statusIndex = isAssigned
        ? weightedIndex(random, [22, 24, 34, 20])
        : random() < 0.12
          ? 3
          : 0;
      const status = STATUS_CHAIN[statusIndex]!;

      // Activity offsets are built relative to creation, then the whole timeline
      // is anchored to a point in the past that leaves room for its full span.
      const activities: SeedActivity[] = [
        {
          type: 'CREATED',
          at: 0,
          previousValue: null,
          newValue: null,
          actorId: requester.id,
          actorName: requester.name,
        },
      ];

      let cursor = 0;
      let assignee = isAssigned ? pick(random, agents) : null;

      if (assignee) {
        cursor += between(random, HOUR, 3 * DAY);
        const dispatcher = pick(random, agents);
        activities.push({
          type: 'ASSIGNEE_CHANGED',
          at: cursor,
          previousValue: null,
          newValue: assignee.id,
          actorId: dispatcher.id,
          actorName: dispatcher.name,
        });

        if (statusIndex > 0 && random() < 0.12) {
          const previous = assignee;
          assignee = pick(random, agents);
          cursor += between(random, 2 * HOUR, 4 * DAY);
          activities.push({
            type: 'ASSIGNEE_CHANGED',
            at: cursor,
            previousValue: previous.id,
            newValue: assignee.id,
            actorId: dispatcher.id,
            actorName: dispatcher.name,
          });
        }
      }

      const actor = assignee ?? pick(random, agents);
      for (let step = 1; step <= statusIndex; step += 1) {
        if (random() < 0.35) {
          cursor += between(random, HOUR, 2 * DAY);
          activities.push({
            type: 'COMMENTED',
            at: cursor,
            previousValue: null,
            newValue: pick(random, COMMENTS),
            actorId: actor.id,
            actorName: actor.name,
          });
        }
        cursor += between(random, 2 * HOUR, 12 * DAY);
        activities.push({
          type: 'STATUS_CHANGED',
          at: cursor,
          previousValue: STATUS_CHAIN[step - 1]!,
          newValue: STATUS_CHAIN[step]!,
          actorId: actor.id,
          actorName: actor.name,
        });
      }

      const span = cursor;
      const createdAt =
        now - between(random, span + HOUR, Math.max(span + HOUR, OLDEST_REQUEST_AGE));

      insertRequest.run(
        id,
        subject,
        description,
        requester.id,
        requester.name,
        category,
        priority,
        status,
        assignee?.id ?? null,
        new Date(createdAt).toISOString(),
        new Date(createdAt + span).toISOString(),
      );

      activities.forEach((activity, activityIndex) => {
        insertActivity.run(
          `${id}-ACT-${activityIndex + 1}`,
          id,
          activity.type,
          activity.actorId,
          activity.actorName,
          new Date(createdAt + activity.at).toISOString(),
          activity.previousValue,
          activity.newValue,
        );
      });
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
