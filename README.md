# Service Request Management Portal

A compact Service Request Management Portal for **As-Sunnah Foundation** built with Next.js (App Router) and SQLite (`node:sqlite`). Enables authorized staff to review, search, filter, and manage service requests with real-time updates and activity tracking.

Designed and optimized for high performance with a dataset of 10,000 service requests and ~37,000 activity records.

---

## Contents

- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Test Credentials](#test-credentials)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Feature Overview](#feature-overview)
- [Testing](#testing)

---

## Requirements

- **Node.js >= 22.5.0** (Node 24 LTS recommended)

The database layer relies on Node's native `node:sqlite` module, requiring zero native binary compilation during `npm install`.

No external database servers, Docker containers, or paid third-party services are required.

---

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) and sign in using any test credential below.

### Database Initialization & Seeding

On initial connection, the application automatically creates `data/app.db`, applies the SQL schema (`src/lib/db/schema.sql`), and seeds 10,000 requests with complete activity histories in under a second.

To reset and re-seed the dataset at any time:

```bash
npm run seed
```

---

## Test Credentials

All seeded staff accounts use the shared password below:

| Name           | Email                          | Role  |
| -------------- | ------------------------------ | ----- |
| Ahmed Faruk    | `ahmed.faruk@assunnah.test`    | Staff |
| Nusrat Jahan   | `nusrat.jahan@assunnah.test`   | Staff |
| Mohammad Salim | `mohammad.salim@assunnah.test` | Staff |
| Tahmina Akter  | `tahmina.akter@assunnah.test`  | Staff |

**Password:** `Assunnah@2026`

_(Additional staff accounts can be found in `src/lib/db/seed-content.ts`)_

---

## Available Scripts

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Starts the development server                        |
| `npm run build`      | Builds the production application bundle             |
| `npm start`          | Runs the production build                            |
| `npm run seed`       | Resets and re-seeds `data/app.db`                    |
| `npm test`           | Executes the test suite (117 tests across unit & UI) |
| `npm run test:watch` | Runs tests in watch mode                             |
| `npm run typecheck`  | Checks TypeScript types without emitting code        |
| `npm run lint`       | Runs ESLint checks                                   |
| `npm run format`     | Formats code with Prettier                           |

---

## Environment Variables

Defined in `.env.example`:

| Variable              | Default           | Purpose                                                     |
| --------------------- | ----------------- | ----------------------------------------------------------- |
| `SESSION_SECRET`      | Dev fallback      | HMAC secret for session cookies. Required in production.    |
| `SESSION_TTL_SECONDS` | `28800` (8 hours) | Cookie session expiration time in seconds.                  |
| `API_LATENCY_MS`      | `0`               | Simulates network latency in development to test UI states. |
| `DATABASE_PATH`       | `data/app.db`     | Path to the SQLite database file.                           |

To test loading skeletons and async feedback states locally:

```bash
API_LATENCY_MS=1000 npm run dev
```

---

## Feature Overview

- **Authentication & Access Control:** Cookie-based session authentication with scrypt password verification and HMAC-SHA256 tokens. Protected server components and API routes.
- **Request Dashboard:** Interactive queue displaying Request ID, Title, Requester, Category, Priority, Status, Assignee, and Last Updated timestamp.
- **Search, Filter & URL State Sync:** 350ms debounced search, multi-field filtering (Category, Priority, Status, Assignee), column sorting, and pagination. All parameters are fully synchronized with the URL.
- **Dynamic Request Details:** Dedicated detail pages (`/requests/[id]`) with request specifications, full activity history timeline, and direct URL accessibility.
- **Optimistic Update Workflow:** Status and assignee updates trigger immediate UI updates with automatic rollback on API failure, duplicate-action prevention, and accessible status feedback.
- **Comprehensive Application States:** Tailored loading skeletons (`loading.tsx`), empty search results, inline validation, global error boundaries (`error.tsx`), and 404 pages.
- **Advanced Workload Analytics:** Per-assignee workload summary utility (`summarizeActivitiesByAssignee`) calculating total assigned, total resolved, and average resolution time over activity streams.
- **Responsive UI & Accessibility:** Responsive table (desktop) and card layout (mobile/tablet), semantic HTML5 elements, ARIA live regions, and full keyboard navigation.

---

## Testing

Run the full test suite with Vitest:

```bash
npm test
```

The test suite includes 117 tests covering server-side queries, auth security, activity aggregation logic, debounced filter inputs, optimistic state rollback, and UI interaction states. Each test worker operates in an isolated temporary database.
