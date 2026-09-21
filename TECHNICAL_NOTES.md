# Technical Note: Architecture & Design Decisions

This document outlines the core technical decisions, architectural patterns, state management approach, and performance strategies for the **As-Sunnah Foundation Service Request Portal**.

---

## 1. Server vs. Client Component Strategy

The application adopts Next.js App Router best practices by making **Server Components the default** across all routes. Client Components are used strictly where browser interactivity or state hooks are required.

### Client Component Boundaries

| Component           | Rationale for Client Component (`'use client'`)                                        |
| ------------------- | -------------------------------------------------------------------------------------- |
| `RequestFilters`    | Manages local input state for debounced search and immediate filter controls.          |
| `RequestUpdateForm` | Handles optimistic UI updates, request state rollback on API error, and pending state. |
| `LoginForm`         | Manages client-side form submission state, inline validation, and pending states.      |
| `MainNav`           | Utilizes `usePathname()` to highlight the active link in the navigation header.        |

### Benefits of Server Component Default

- **Minimal JavaScript Delivery:** The application ships only **~4.7 KB gzipped** of custom client JavaScript to the browser.
- **Direct Database Access:** List and detail pages query the SQLite database directly during server rendering, eliminating secondary HTTP round-trips.
- **Progressive Enhancement:** Table sorting links and pagination controls are standard HTML `<Link>` elements, rendering functional HTML that works seamlessly before or without client hydration.

---

## 2. State Management & Data-Fetching Approach

### URL-Driven Navigational State

All search, filtering, sorting, and pagination parameters (`q`, `category`, `priority`, `status`, `assignee`, `sort`, `order`, `page`, `pageSize`) are stored directly in the URL search parameters.

- **Deep Linking & Refresh:** Direct URL access, bookmarking, and browser back/forward navigation work out-of-the-box.
- **Single Source of Truth:** `parseRequestQuery` and `buildRequestsHref` encapsulate URL state parsing and generation, guaranteeing consistent parameter handling across server components, client components, and API routes.

### Server-Owned Data Flow & Revalidation

- **No Client State Synchronization:** The server remains the single source of truth. Upon a successful status or assignee update, `router.refresh()` triggers a server re-render to update dependent server components (such as header badges and activity timelines) automatically.
- **Dynamic Data Freshness:** Every data route renders dynamically to prevent stale cached data in a multi-user service desk environment.

---

## 3. Performance & Scale Considerations (10,000+ Records)

The portal is designed to maintain single-digit millisecond query times across 10,000 requests and ~37,000 activity logs.

### Key Performance Optimizations

- **SQL-Level Pagination & Filtering:** All filtering (`WHERE`), sorting (`ORDER BY`), and pagination (`LIMIT`/`OFFSET`) execute directly within SQLite. The browser receives only the 25–100 records displayed on the current page.
- **Indexed Database Schema:** B-tree indexes are established on all queryable and sortable fields (`status`, `priority`, `category`, `assignee_id`, `updated_at`, `priority_rank`, `status_rank`).
- **Deterministic Sort Tiebreakers:** Every query includes a secondary tiebreaker (`ORDER BY <column> <dir>, id ASC`) to prevent missing or duplicated rows during pagination when sorting by non-unique columns (e.g., status or priority).
- **Generated Rank Columns:** Stored generated columns (`priority_rank` and `status_rank`) allow non-alphabetical domain orderings (e.g., URGENT → LOW) to leverage SQLite indexes efficiently.
- **Debounced Search Input:** Search input changes are debounced at 350 ms to prevent unnecessary server requests during active typing.

---

## 4. Application Structure & Architecture

```
src/
  app/
    (app)/            # Protected application routes (layout owns session check)
      requests/       # Request dashboard & dynamic detail routes ([id])
      performance/    # Assignee workload summary report
    api/              # RESTful API route handlers (JSON endpoints)
    login/            # Public sign-in page
  components/
    layout/           # App shell and navigation components
    requests/         # Request dashboard table, filters, timeline, & update forms
    ui/               # Primitive UI components (Button, Badges, ErrorState)
  lib/
    activity/         # Activity aggregation & workload summarization logic
    api/              # HTTP error formatting and response helpers
    auth/             # Password hashing (scrypt), HMAC tokens, session cookie handling
    db/               # SQLite connection, schema definition, & seed generator
    requests/         # Data access queries & URL parameter helpers
  types/              # TypeScript domain types & API schemas
```

### Security & Error Handling

- **Authentication:** Passwords are hashed using Node's `scrypt` with random salt and verified via `timingSafeEqual`. Authenticated sessions issue an HMAC-SHA256 signed cookie (`HttpOnly`, `SameSite=Lax`).
- **Layered Auth Protection:** Middleware handles fast redirects, while server layouts (`requireSession`) and route handlers (`getSession`) enforce strict session verification prior to executing database queries.
- **API Error Handling:** API responses return standardized JSON error envelopes. Input payloads are strictly validated with Zod, and data layer operations return discriminated unions to handle expected failures gracefully.

---

## 5. Advanced JavaScript Utility Implementation

The per-assignee activity summary utility (`summarizeActivitiesByAssignee` in `src/lib/activity/summarize.ts`) aggregates flat activity streams into workload metrics:

- **Metrics Computed:** Total Assigned requests, Total Resolved requests, and Average Resolution Time (milliseconds from initial assignment to first resolution).
- **Performance:** Runs in **$O(N)$ linear time** using a single-pass Map aggregation without sorting array subsets.
- **Resiliency:** Handles invalid timestamps, missing assignee IDs, null values, and out-of-order events gracefully without throwing exceptions or corrupting calculations.
