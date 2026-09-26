# ANU Degree Planner — agent harness

This repo is a COMP4020 crit 7 submission: "build the ANU system you wish
existed". The product is a **degree planner** for one demo student in one demo
degree. Read `README.md` for what the app is and what good means here; the
published spec is at
<https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/07-anu-system/>.

## The one flow that matters

Browse a course → mark it completed / current / planned → the form POSTs to
the server → SQLite changes → the page re-renders from the database → a
reload shows the same state. Every change you make either serves this flow or
needs a reason. Before adding a feature, ask: does this improve the core
planning workflow? If not, don't build it.

## Data rules

- `src/lib/schema.ts` is the ground truth. Change the database only by editing
  it, running `pnpm db:generate`, and committing the migration it writes to
  `drizzle/`. Never hand-edit a migration that has been committed, and never
  create tables outside a migration.
- Store facts, derive everything else. Completed units, remaining units,
  requirement progress, percentages, course level and eligibility are computed
  in `src/lib/planner.ts` from rows — never stored in a column, never typed
  into a page as a literal.
- Everything a page shows about the student comes from the database on that
  request. No hard-coded progress, no localStorage/sessionStorage, no
  client-side state that the server doesn't know about.
- `src/lib/planner.ts` stays pure: no database import, no I/O. It takes rows
  and returns derived state, so it can be unit-tested directly.

## Interaction rules

- Writes are plain HTML forms that POST to an endpoint and 303-redirect back.
  The app must work with JavaScript off; the only client script is the SSE
  "changed in another tab" notice.
- Do not disable Astro's origin check and do not prerender pages: the CI
  deploy job POSTs to `/` and fails if CSRF protection is off.
- Keep `/api/events` streaming: the CI deploy job probes it.
- User-facing errors are fixed messages chosen by code, never raw exception
  text or a string echoed from the query.

## Honesty rules

- Course codes and titles follow ANU's, but prerequisites, offerings and the
  degree's rules are simplified for the demo. Never present them as official
  ANU policy, and keep the "prototype, not an official degree audit" notice
  visible on every page.
- Don't invent the author's experience. `reflections/crit-7.md` and the
  personal parts of `PROCESS.md` are the author's to write; draft structure
  only, clearly marked.

## Scope

Out of scope unless the author asks: authentication, real ANU data or
scraping, ANUHub/Canvas integration, AI recommendations, drag-and-drop,
notifications, admin pages, multiple students or universities, any client
framework. A small complete product beats a large incomplete one.

## Checks — run them, don't assume

- `pnpm check` (typecheck + build + all of `spec/`) after every meaningful
  change, and before every commit. Report failures with their output.
- Every page route goes in `spec/routes.ts`, or the accessibility invariants
  silently stop covering it.
- New behaviour gets a test in `spec/`: contracts over HTTP against the built
  server (`spec/planner.test.ts`), pure logic directly
  (`spec/planner-logic.test.ts`). Test what the page must do, not its markup.
- Spec test files share one server and one database and run in parallel:
  a test that mutates the demo student must use courses no other file touches,
  or reset first and run in the file that owns resets.
- Before committing docs: `pnpm check:evidence`.

## Working in this repo

- On this WSL machine there's no `make`, so `pnpm install` fails compiling
  better-sqlite3's fallback; use `pnpm install --ignore-scripts` (the package
  ships a prebuilt binary). Fly's Docker build has a toolchain and is fine.
- Commit at each working milestone with a message saying what changed and
  why. No squashing, no manufactured history.
- Deploying: `flyctl deploy --remote-only --ha=false -a comp4020-crit7-kyle-zjy`
  with the token in `mise.local.toml`. Never commit the token.
