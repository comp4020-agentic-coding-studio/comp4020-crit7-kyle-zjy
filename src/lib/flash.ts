import { termLabel, parseTermKey } from "./planner";

// After a write, the endpoint redirects back with a short code in the query
// string; the page turns the code into a fixed sentence. Nothing a visitor
// types is ever echoed back as a message.

export type Done = "planned" | "current" | "completed" | "removed" | "reset";
export type Failure = "unknown-course" | "bad-action" | "bad-term" | "not-recorded" | "failed";

const FAILURES: Record<Failure, string> = {
  "unknown-course": "That course isn't in the catalogue, so nothing was changed.",
  "bad-action": "That change isn't one the planner understands, so nothing was changed.",
  "bad-term": "Pick one of the upcoming semesters to plan a course into.",
  "not-recorded": "That course wasn't in your records, so there was nothing to remove.",
  failed: "Something went wrong saving that change. Nothing was saved — please try again.",
};

export interface Flash {
  kind: "done" | "error";
  message: string;
}

export function readFlash(url: URL, courseCodes: Set<string>): Flash | null {
  const error = url.searchParams.get("error") as Failure | null;
  if (error && error in FAILURES) return { kind: "error", message: FAILURES[error] };

  const done = url.searchParams.get("done") as Done | null;
  if (done === "reset") return { kind: "done", message: "Demo data restored to its starting state." };
  // only a code that's really in the catalogue is shown back
  const code = url.searchParams.get("course") ?? "";
  if (!done || !courseCodes.has(code)) return null;
  const term = parseTermKey(url.searchParams.get("term") ?? "");
  switch (done) {
    case "planned":
      return { kind: "done", message: `${code} added to your plan${term ? ` for ${termLabel(term)}` : ""}.` };
    case "current":
      return { kind: "done", message: `${code} moved to your current courses.` };
    case "completed":
      return { kind: "done", message: `${code} marked as completed.` };
    case "removed":
      return { kind: "done", message: `${code} removed from your records.` };
    default:
      return null;
  }
}

/** A same-site path to go back to, or the dashboard if it looks like anything else. */
export function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(path) ? path : "/";
}
