# Service Request Management Portal

An internal service desk for As-Sunnah Foundation. Staff sign in, work through a queue of
service requests raised across the organisation, and update the status and owner of each one.

The dataset is 10,000 requests and ~37,000 activity records. Every search, filter, sort and
page is resolved in the data layer, so the browser only ever receives the 25–100 rows it is
showing.

---

## Contents

- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Test credentials](#test-credentials)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Known limitations](#known-limitations)

See [TECHNICAL_NOTES.md](./TECHNICAL_NOTES.md) for the reasoning behind the main decisions.

---

## Requirements

- **Node.js 22.5 or newer** (24 LTS recommended)

The data layer uses `node:sqlite`, the SQLite build shipped inside Node since 22.5. That keeps
the project free of native modules — `npm install` never compiles anything — at the cost of
requiring a recent Node. Check yours with `node --version`.

Nothing else is needed: no database server, no Docker, no external or paid service.

## Getting started

```bash
npm install
```

```bash
cp .env.example .env.local
```

Generate a session signing secret and put it in `.env.local` as `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In development the app falls back to a built-in secret if you skip this, so it will run
either way. In production a weak or missing `SESSION_SECRET` is a startup error.

```bash
npm run dev
```

Open <http://localhost:3000> and sign in.

### Database and seed data

There is no separate database step. On first connection the app creates `data/app.db`,
applies [`src/lib/db/schema.sql`](./src/lib/db/schema.sql), and — finding it empty — seeds
10,000 requests and their activity history. It takes under a second.

To rebuild the dataset from scratch at any point:

```bash
npm run seed
```

Seed data is generated from a seeded PRNG, so the same command always produces the same
requests, subjects, priorities and assignment history. `data/` is git-ignored.

## Test credentials

Every seeded staff account uses the same password:

| Email                          | Name           |
| ------------------------------ | -------------- |
| `ahmed.faruk@assunnah.test`    | Ahmed Faruk    |
| `nusrat.jahan@assunnah.test`   | Nusrat Jahan   |
| `mohammad.salim@assunnah.test` | Mohammad Salim |
| `tahmina.akter@assunnah.test`  | Tahmina Akter  |

Password: `Assunnah@2026`

Four more staff accounts exist — the full list is in
[`src/lib/db/seed-content.ts`](./src/lib/db/seed-content.ts). The 240 seeded _requesters_ have
no password and cannot sign in; they only raise requests.

## Scripts

| Command              | What it does                      |
| -------------------- | --------------------------------- |
| `npm run dev`        | Development server                |
| `npm run build`      | Production build                  |
| `npm start`          | Serve the production build        |
| `npm run seed`       | Drop and regenerate `data/app.db` |
| `npm test`           | Run every test once               |
| `npm run test:watch` | Watch mode                        |
| `npm run typecheck`  | `tsc --noEmit`                    |
| `npm run lint`       | ESLint                            |
| `npm run format`     | Prettier write                    |

## Environment variables

All optional for local development — see [`.env.example`](./.env.example).

| Variable              | Default           | Purpose                                                          |
| --------------------- | ----------------- | ---------------------------------------------------------------- |
| `SESSION_SECRET`      | dev-only fallback | HMAC key for the session cookie. Required in production.         |
| `SESSION_TTL_SECONDS` | `28800` (8h)      | Session lifetime.                                                |
| `API_LATENCY_MS`      | `0`               | Artificial delay on server reads, development only.              |
| `DATABASE_PATH`       | `data/app.db`     | SQLite file location. The test suite points this at a temp file. |

### Seeing the loading states

Loading, skeleton and pending states are hard to see against a database that answers in
single-digit milliseconds. Set a delay and they become visible:

```bash
API_LATENCY_MS=1000 npm run dev
```

This is ignored in production builds, so no shipped response is ever slowed down to make a
spinner appear.

---

## Architecture

### Routes

```
/login                     Sign in
/requests                  Dashboard: search, filters, sorting, pagination
/requests/[id]             Request detail, activity timeline, status + assignee updates
/performance               Per-assignee workload report

/api/auth/login            POST   sign in, sets the session cookie
/api/auth/logout           POST   clears it and redirects
/api/requests              GET    paginated, filtered, sorted list
/api/requests/[id]         GET    one request with its activity
                           PATCH  update status and/or assignee
```

### Layers

```
src/
  app/
    (app)/            Protected pages — the route group owns the shell and the auth guard
    api/              Route handlers
    login/            Public sign-in page
  components/
    layout/           App shell and navigation
    requests/         Request-specific UI (table, filters, timeline, update form)
    ui/               The two shared primitives that earned their place
  lib/
    activity/         Activity summarisation
    api/              HTTP error envelope
    auth/             Password hashing, session tokens, session cookie
    db/               SQLite connection, schema, deterministic seed generator
    requests/         Queries, URL-state parsing, write validation
  types/              Domain model
```

### Server and Client Components

Server Components are the default. Four components opt into the client, each for a specific
interaction:

| Component           | Why it is a Client Component                  |
| ------------------- | --------------------------------------------- |
| `RequestFilters`    | Debounced search input and filter controls    |
| `RequestUpdateForm` | Optimistic updates and rollback               |
| `LoginForm`         | Inline validation and pending state           |
| `MainNav`           | Highlights the active link from `usePathname` |

Everything else — the table, pagination, badges, activity timeline, app shell — renders on the
server and ships no JavaScript. Sorting and pagination are plain `<Link>`s, so they work
without client JavaScript at all.

### Authentication

- Sign-in verifies a scrypt hash with `timingSafeEqual` and issues an HMAC-SHA256 signed token
  in an **HTTP-only, SameSite=Lax** cookie (`Secure` in production). No credential or token is
  ever written to `localStorage`.
- `src/proxy.ts` redirects visitors without a session cookie, and redirects signed-in visitors
  away from `/login`. **This is a redirect, not an authorization check** — it only looks for the
  presence of a cookie, never its signature.
- Real enforcement happens server-side: the protected layout calls `requireSession()`, _and so
  does every page inside it_, because Next renders layouts and pages in parallel and a layout
  redirect alone would not stop a page from reading data. Every route handler independently
  calls `getSession()` before touching the database.
- Forging the cookie therefore gets a visitor a redirect, never data.

### Data layer

SQLite via `node:sqlite`, one connection cached on `globalThis` so the dev server's hot reload
does not leak handles. All reads and writes go through
[`src/lib/requests/queries.ts`](./src/lib/requests/queries.ts); no component builds SQL.

A status or assignee update runs in a transaction that writes the request row and one activity
row per field that actually changed. Submitting values that match the current ones is a no-op
that returns the unchanged request — which is what makes an impatient double-click harmless.

## Data model

`ServiceRequest`, `Activity`, `User` and the status/priority unions live in
[`src/types/domain.ts`](./src/types/domain.ts). Two deliberate refinements on the brief's
starting model:

- **`ServiceRequestListItem` vs `ServiceRequestDetail`.** The list view does not need
  descriptions, activity or email addresses, so it has its own narrower type and the list query
  selects fewer columns. The type reflects what is actually fetched instead of padding absent
  fields with empty strings.
- **`priority_rank` and `status_rank` generated columns.** Priority sorts URGENT → LOW and
  status follows the workflow, neither of which is alphabetical. The ranks are stored, indexed,
  generated columns, so those sorts are served from an index rather than a scan.

## Performance

Measured locally against the full 10,000-request dataset (production build, warm):

| Metric                                    | Value              |
| ----------------------------------------- | ------------------ |
| Filtered + sorted page query              | ~6 ms              |
| Deep pagination (`OFFSET 9000`)           | ~21 ms             |
| `/requests` HTML document                 | 17 KB gzipped      |
| Client JavaScript, total                  | 175 KB gzipped     |
| — of which is this application's own code | **4.7 KB gzipped** |
| Rows sent to the browser                  | 25 of 10,000       |

How that is achieved:

- **All narrowing happens in SQL.** `WHERE`, `ORDER BY` and `LIMIT/OFFSET` are built from the
  validated query; the browser never receives a row it is not displaying. `COUNT(*)` over the
  same filter supplies the pagination metadata.
- **Indexes** on every filterable and sortable column, plus the two rank columns.
- **A stable sort tiebreaker.** Every query ends `ORDER BY <column> <dir>, id ASC`. Without it,
  duplicate values in the sort column let `OFFSET` paging repeat or skip rows between pages.
- **The page reads the data layer directly** rather than fetching its own API over HTTP, which
  would mean a second round trip and a second serialisation of the same rows.
- **`requester_name` is denormalised** onto `requests`. Searching across the requester's name
  used to require a join; folding the column in cut the filtered search from ~37 ms to ~6 ms.
  It is safe to denormalise because a request's requester never changes.
- **Search is debounced at 350 ms** — typing "printer" issues one request, not seven.
- **Zod is kept out of the client bundle.** The URL-state module is imported by a Client
  Component, so parsing there uses a small explicit allowlist rather than a schema. Moving Zod
  out of that import path removed 387 KB of uncompressed JavaScript from the browser; it is
  still used, strictly, to validate request bodies on the server.

## Accessibility

- Semantic HTML throughout: one `<h1>` per page, real `<table>` markup with `<caption>`,
  `scope` and `aria-sort`, `<nav aria-label>` landmarks, `<fieldset>`/`<legend>` on the update
  form, and a `<time datetime>` for every timestamp.
- Every control has a real `<label>`; validation messages are tied to their input with
  `aria-describedby` and `aria-invalid`.
- **Status and priority are never conveyed by colour alone.** Both always render a text label,
  and priority additionally shows a four-step bar so the ordering is visible without hue.
- Live regions announce asynchronous outcomes: `role="status"` for "Saving…", "Updating
  results…" and success messages, `role="alert"` for failures.
- One consistent, visible focus ring on every interactive element. Saving disables the update
  fieldset, which would normally drop focus to the body, so focus is restored to the control
  the user was using once the save completes.
- Pagination and sorting are real links — keyboard-reachable, middle-clickable, and functional
  with JavaScript disabled.
- **Responsive layout verified at every breakpoint**, not just assumed. The dense table appears
  from `lg` and reveals columns progressively (6 at 1024px, 8 at 1280px, 9 at 1536px); below
  `lg` a card list takes over, with sort and order controls that replace the column headers.
  No breakpoint produces horizontal page scroll or a clipped column.
- `prefers-reduced-motion` is respected.

## Testing

```bash
npm test
```

117 tests in two Vitest projects:

- **`server`** (Node) — the activity summariser, URL-state parsing and serialisation, session
  token signing and tampering, the data layer against a real seeded SQLite file, and the route
  handlers invoked directly.
- **`ui`** (jsdom + Testing Library) — debounced search, filter combination, sorting links,
  pagination windowing, optimistic update and rollback, duplicate-submission prevention, login
  error handling, and malformed activity records.

Each worker seeds its own temporary database, so tests never touch `data/app.db`.

## Known limitations

Things a reviewer would reasonably ask about, and where they landed:

- **`notFound()` returns HTTP 200 for the detail page.** This is a documented Next.js
  constraint, not an oversight: once a `<Suspense>` fallback renders — which `loading.tsx`
  creates — the server has committed to `200 OK` to start streaming, and the status cannot be
  revised when `notFound()` fires later. Next mitigates it by injecting
  `<meta name="robots" content="noindex">`, which this app does emit. Getting a real 404 would
  mean deleting the loading skeletons on both request routes; keeping them was the better trade
  for an internal tool that is never crawled. `GET /api/requests/[id]` returns a proper 404,
  which is what programmatic clients actually consume.
- **Search uses `LIKE '%term%'`**, which scans. At 10,000 rows that is ~6 ms, so a full-text
  index would be complexity without a measurable payoff. SQLite's FTS5 is the next step if the
  dataset grows by an order of magnitude.
- **The responsive list renders both layouts** — a table from `lg` up, cards below — and CSS
  hides one. It costs a few KB of duplicated markup per page and keeps a single data path;
  the alternative was a JavaScript breakpoint check, which would have cost more.
- **Deep pagination uses `OFFSET`**, which grows linearly with page number (~21 ms at page 360).
  Keyset pagination would be constant-time but cannot express "jump to page 360", which this UI
  offers.
- **The portal manages existing requests; it does not create them.** Raising a request was not
  in scope, so the seed generator stands in for intake.
