# Technical note

Major decisions and why they were made. Setup, credentials and measurements are in the
[README](./README.md).

---

## Server vs Client Components

Server Components are the default; a component opts into the client only when a specific
interaction forces it, and the boundary is drawn as low in the tree as possible.

| Client Component    | Reason                                    |
| ------------------- | ----------------------------------------- |
| `RequestFilters`    | Local input state and the search debounce |
| `RequestUpdateForm` | Optimistic update and rollback            |
| `LoginForm`         | Inline validation and pending state       |
| `MainNav`           | `usePathname` to mark the active link     |

Everything else stays on the server. The list page reads the session, normalises the URL query
and renders the table, pagination, badges and timeline as HTML. Sorting and pagination are
`<Link>` elements pointing at the next URL, so they need no client JavaScript at all — and keep
working without it.

The alternative, a client page fetching `/api/requests`, would have shipped the table, badges,
date formatting and pagination logic to the browser plus a round trip after hydration for data
the server already had. As built, the application's own client code is **4.7 KB gzipped**; the
remaining 175 KB is the React and Next.js runtime.

## State and data fetching

**The URL owns navigational state.** Search, four filters, sort field, direction, page and page
size are all search parameters. That is what makes refresh, deep links and browser back/forward
work, and it lets the server render the correct page from the request alone.
`parseRequestQuery` and `buildRequestsHref` live in the same module so the two directions cannot
drift; a round-trip test pins it.

**The server owns data.** No client cache, no store mirroring the database. After a mutation,
`router.refresh()` re-renders the server tree, which is how the activity timeline and header
badges update without the form knowing they exist.

**Components own only ephemeral state** — the search box's in-progress text, and the update
form's pending value. There is no global state library and no React Context.

**Pages read the data layer directly** rather than fetching their own API over HTTP, which would
cost a round trip and a redundant serialisation. The API routes still exist for the client-side
`PATCH` and external consumers, and they share `parseRequestQuery` and `queryRequests` with the
page, so the two paths cannot diverge.

**Caching is deliberately absent.** Every data route is dynamic. Results depend on a session
cookie and on data colleagues are actively changing; serving a cached list would be a
correctness bug, and the measured cost of skipping it is ~6 ms per query. Streaming is used
where it helps: the results table sits in a `<Suspense>` keyed on the query, so changing a
filter shows a skeleton rather than stale rows.

## Performance

Measured against the full 10,000-request dataset, production build:

| Metric                          | Value         |
| ------------------------------- | ------------- |
| Filtered + sorted page query    | ~6 ms         |
| Deep pagination (`OFFSET 9000`) | ~21 ms        |
| `/requests` HTML                | 17 KB gzipped |
| Client JS (app's own / total)   | 4.7 / 175 KB  |
| Rows sent to the browser        | 25 of 10,000  |

All narrowing happens in SQL — `WHERE`, `ORDER BY`, `LIMIT/OFFSET` built from the validated
query, with indexes on every filterable and sortable column. Three decisions are less obvious:

- **A stable sort tiebreaker.** Every query ends `ORDER BY <column> <dir>, id ASC`. With only
  four distinct statuses across 10,000 rows, sorting by status without it leaves the order
  within a group undefined, so `OFFSET` paging can repeat rows from page 1 and skip others.
- **`requester_name` denormalised** onto `requests`. Searching the requester's name required a
  join; folding the column in cut filtered search from ~37 ms to ~6 ms. Safe because a request's
  requester never changes — the assignee, which does change, still joins on a primary key.
- **Generated rank columns.** Priority sorts URGENT → LOW and status follows the workflow, so a
  `CASE` in `ORDER BY` would prevent index use. `priority_rank` and `status_rank` are stored,
  indexed, generated columns.

Deliberately not done: no FTS index (LIKE costs 6 ms here), no query cache (correctness), no
virtualised table (25–100 rows), no memoisation (the work is in SQL).

## Application structure

```
src/
  app/(app)/     Protected pages — route group owns the shell and the auth guard
  app/api/       Route handlers
  app/login/     Public sign-in
  components/    layout · requests · ui (only Button and ErrorState are shared)
  lib/           activity · api · auth · db · requests
  types/         Domain model
```

Each `lib` module is domain-oriented: `queries.ts` is the only place SQL is written,
`search-params.ts` the only place URL state is parsed or built. No component builds a query.

---

## Other decisions, in brief

**Validation — two rules.** Query parameters are _normalised_, never rejected: `?status=BANANA`
drops the filter rather than erroring, because a stale URL should still render a list.
Normalisation is an explicit allowlist, not a schema, which keeps Zod out of the Client
Component that imports the module — worth 387 KB of uncompressed browser JavaScript. Request
_bodies_ are the opposite: strictly validated by Zod and rejected with 422, because an
unexpected value there is a client bug worth surfacing.

**Mutations.** The update form applies a change optimistically, disables the fieldset, then
PATCHes. On success it adopts the value the **server** returned rather than the one it sent, so
the UI cannot drift from the database; on failure it restores the previous value and explains
why. Duplicate submissions are blocked twice — the disabled fieldset client-side, and a no-op
in the data layer when submitted values match current ones. Disabling a fieldset drops keyboard
focus, so focus is restored to the control the user was operating.

**Authentication.** scrypt + `timingSafeEqual`, then an HMAC-signed token in an HTTP-only
SameSite=Lax cookie. `proxy.ts` only does fast redirects on cookie _presence_ — real
enforcement is the layout, **every page inside it** (layouts and pages render in parallel, so a
layout guard alone would not stop a page reading data), and every route handler independently.

**Errors.** Handlers follow one shape: authenticate, parse, validate, act, map failure, respond.
Nothing derived from an exception or SQL error reaches a response — a test asserts error bodies
contain no trace of `sqlite`, `SELECT` or a stack frame. Sign-in returns one message for both
unknown email and wrong password, so it cannot enumerate accounts. The data layer signals
expected failures as a discriminated union rather than throwing.

**SQLite via `node:sqlite`.** A real database makes server-side filtering, sorting and paging
honest — indexes, `COUNT(*)`, query plans — where an in-memory array would only imitate them.
The built-in module avoids native compilation on a reviewer's machine; the cost is Node 22.5+,
declared in `engines`.

**Testing.** 117 tests in two Vitest projects — `server` against a real seeded SQLite file, `ui`
in jsdom. They target behaviour: that seven keystrokes produce one navigation, that a 401 leaves
data genuinely unchanged, that a failed update rolls back, that a malformed activity record
renders instead of crashing. Two notes on the tests themselves: `userEvent` deadlocks under
Vitest fake timers here, so debounce tests use `fireEvent`; and update tests take a request from
an ordered list rather than at random, after an early `Math.random()` version proved flaky.

**Left out on purpose.** No repository/service/controller layering around four SQL functions. No
global state, context providers or state machine. No component library — native `<select>` is
accessible and keyboard-native. No custom hooks (`useDebouncedValue` was considered and dropped;
it is used once). No barrel files.

The application is ~5,150 lines including tests, which is roughly what this feature set needs.
