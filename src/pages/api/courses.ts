import type { APIRoute } from "astro";
import { bus } from "../../lib/events";
import { type Done, FLASH_PARAMS, type Failure, safeReturnPath } from "../../lib/flash";
import { CURRENT_TERM, compareTerms, parseTermKey, planningTerms, termKey } from "../../lib/planner";
import { loadPlanner, removeCourse, setCourseStatus } from "../../lib/store";

// Every change to the student's courses comes through here: a plain HTML
// form POSTs { course, action, term?, returnTo }, SQLite changes, and a 303
// sends the browser back to re-render from the database — no client-side
// state, and it works with JavaScript off. Other open tabs hear about it
// over the SSE stream (see src/pages/api/events.ts).
//
// Actions:
//   plan     — planned for `term`, one of the upcoming semesters
//   current  — being taken this semester
//   complete — done (keeps the term it was taken in, if that's past)
//   remove   — dropped from the student's records
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const back = safeReturnPath(form.get("returnTo"));
  const code = String(form.get("course") ?? "").trim().toUpperCase();
  const action = String(form.get("action") ?? "");

  const go = (params: Record<string, string>) => {
    const url = new URL(back, "http://x");
    for (const key of FLASH_PARAMS) url.searchParams.delete(key);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return redirect(`${url.pathname}${url.search}`, 303);
  };
  const fail = (error: Failure) => go({ error });
  const done = (what: Done, extra: Record<string, string> = {}) => {
    bus.emit("change", { course: code, action: what });
    return go({ done: what, course: code, ...extra });
  };

  try {
    const data = loadPlanner();
    if (!data.catalog.some((course) => course.code === code)) return fail("unknown-course");
    const existing = data.records.find((record) => record.code === code);

    switch (action) {
      case "plan": {
        const term = parseTermKey(String(form.get("term") ?? ""));
        const allowed = planningTerms().map(termKey);
        if (!term || !allowed.includes(termKey(term))) return fail("bad-term");
        setCourseStatus(code, "planned", term);
        return done("planned", { term: termKey(term) });
      }
      case "current":
        setCourseStatus(code, "current", CURRENT_TERM);
        return done("current");
      case "complete": {
        const term =
          existing && compareTerms(existing, CURRENT_TERM) <= 0 ? existing : CURRENT_TERM;
        setCourseStatus(code, "completed", term);
        return done("completed");
      }
      case "remove":
        if (!removeCourse(code)) return fail("not-recorded");
        return done("removed");
      default:
        return fail("bad-action");
    }
  } catch (error) {
    // logged for whoever runs the server; the student sees a fixed message
    console.error("course update failed", error);
    return fail("failed");
  }
};
