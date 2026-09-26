# Process overview

## What I built

ANU Degree Planner: record courses as completed, current or planned, and see
degree progress, open requirements and eligible next courses, all derived
from SQLite. `README.md` says what good means here.

## How I got here

I briefed the agent with the problem and a hard scope limit:

> Do not build a giant degree-audit system. Focus on a polished, believable,
> small vertical slice.

I also asked it to read the whole starter before planning. That surfaced a
constraint the brief didn't mention: the CI deploy job probes `/api/events`,
so the SSE endpoint had to survive the guestbook's removal. I wrote the
harness before any code
([`8b533d6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/8b533d6)).
Its rules: the schema is the source of truth, derived values are never
stored, and writes are form POSTs only.

I built it in vertical slices. First the schema, seed data and a bare
dashboard
([`7f12ef8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/7f12ef8)).
Then persistence, with an HTTP test that plans a course and reloads
([`c17dad1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/c17dad1)).
I knew that test was real because stubbing out the write turned it red.
A restart against a real database file kept the plan. A stale build once
made persistence look broken, and that lesson went into `CLAUDE.md`
([`55a3651`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/55a3651)).

The guestbook went only after that
([`9af8304`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/9af8304)),
with a migration verified against an older database. Visual polish came
last, from screenshots
([`bfb12ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-kyle-zjy/commit/bfb12ef)).
They showed that "still required" double-counted and that on phones the
next-course list was buried. The axe invariant caught a notice sitting
outside any landmark.

<!-- AUTHOR: add one or two sentences in your own words: a moment where you
     redirected or corrected the agent, and what you'd do differently. -->
