import type { Session, Status } from "./schema";

// The planner's derived state, computed from database rows on every request.
// Nothing here touches the database or stores anything: it takes the rows
// and returns what the pages show, so it can be tested on plain objects.

export interface Term {
  year: number;
  session: Session;
}

export interface CatalogCourse {
  code: string;
  title: string;
  units: number;
  description: string;
  sessions: Session[];
  prerequisites: string[];
}

export interface StudentRecord extends Term {
  code: string;
  status: Status;
}

export interface Requirement {
  name: string;
  description: string;
  requiredUnits: number;
  rule: "list" | "level";
  // rule = list
  courseCodes: string[];
  // rule = level
  codePrefix: string | null;
  minLevel: number | null;
}

// The demo's "now". A real system would read the academic calendar; the demo
// pins it so the seed data (current courses in S2 2026) stays coherent.
export const CURRENT_TERM: Term = { year: 2026, session: "S2" };

// A standard full-time load at ANU is 24 units a semester; more than that is
// flagged, as information only.
export const FULL_TIME_UNITS = 24;

// --- terms -----------------------------------------------------------------

export function compareTerms(a: Term, b: Term): number {
  return a.year - b.year || a.session.localeCompare(b.session);
}

export function nextTerm(term: Term): Term {
  return term.session === "S1"
    ? { year: term.year, session: "S2" }
    : { year: term.year + 1, session: "S1" };
}

/** The terms a course can be planned into: the next `count` after now. */
export function planningTerms(count = 4, from: Term = CURRENT_TERM): Term[] {
  const terms: Term[] = [];
  let term = from;
  for (let i = 0; i < count; i++) {
    term = nextTerm(term);
    terms.push(term);
  }
  return terms;
}

export function termLabel(term: Term): string {
  return `Semester ${term.session === "S1" ? 1 : 2}, ${term.year}`;
}

export function termKey(term: Term): string {
  return `${term.year}-${term.session}`;
}

export function parseTermKey(key: string): Term | null {
  const match = /^(\d{4})-(S1|S2)$/.exec(key);
  return match ? { year: Number(match[1]), session: match[2] as Session } : null;
}

// --- courses ---------------------------------------------------------------

/** COMP2100 → 2000. The level is part of the code, so it's never stored. */
export function levelOf(code: string): number {
  return Number(code.charAt(4)) * 1000;
}

export function prefixOf(code: string): string {
  return code.slice(0, 4);
}

export function sessionLabel(session: Session): string {
  return session === "S1" ? "Semester 1" : "Semester 2";
}

// --- degree progress -------------------------------------------------------

export interface UnitTotals {
  completed: number;
  current: number;
  planned: number;
}

function totalsOf(records: StudentRecord[], units: Map<string, number>): UnitTotals {
  const totals: UnitTotals = { completed: 0, current: 0, planned: 0 };
  for (const record of records) totals[record.status] += units.get(record.code) ?? 0;
  return totals;
}

function unitsByCode(catalog: CatalogCourse[]): Map<string, number> {
  return new Map(catalog.map((course) => [course.code, course.units]));
}

export interface DegreeProgress extends UnitTotals {
  total: number;
  /** units still to complete: total − completed */
  toComplete: number;
  /** units no completed, current or planned course accounts for yet */
  unplanned: number;
  percentComplete: number;
}

export function degreeProgress(
  totalUnits: number,
  catalog: CatalogCourse[],
  records: StudentRecord[],
): DegreeProgress {
  const totals = totalsOf(records, unitsByCode(catalog));
  const completed = Math.min(totals.completed, totalUnits);
  return {
    ...totals,
    total: totalUnits,
    toComplete: totalUnits - completed,
    unplanned: Math.max(0, totalUnits - totals.completed - totals.current - totals.planned),
    percentComplete: Math.round((completed / totalUnits) * 100),
  };
}

// --- requirements ----------------------------------------------------------

export function countsToward(requirement: Requirement, code: string): boolean {
  if (requirement.rule === "list") return requirement.courseCodes.includes(code);
  return (
    prefixOf(code) === requirement.codePrefix && levelOf(code) >= (requirement.minLevel ?? 0)
  );
}

export type RequirementState = "complete" | "in-progress" | "not-started";

export interface RequirementProgress extends UnitTotals {
  requirement: Requirement;
  required: number;
  state: RequirementState;
  /** units the completed, current and planned courses together leave uncovered */
  gap: number;
  /** the student's courses that count toward it, in catalogue order */
  courses: StudentRecord[];
}

/**
 * How far the student is through one requirement. A course can count toward
 * more than one requirement — a 3000-level elective counts toward both the
 * electives list and the advanced-computing requirement — which is how level
 * requirements overlap with course lists in real degree rules.
 */
export function requirementProgress(
  requirement: Requirement,
  catalog: CatalogCourse[],
  records: StudentRecord[],
): RequirementProgress {
  const counting = records.filter((record) => countsToward(requirement, record.code));
  const totals = totalsOf(counting, unitsByCode(catalog));
  const required = requirement.requiredUnits;
  const completed = Math.min(totals.completed, required);
  const state: RequirementState =
    completed >= required
      ? "complete"
      : totals.completed > 0 || totals.current > 0
        ? "in-progress"
        : "not-started";
  const order = new Map(catalog.map((course, index) => [course.code, index]));
  return {
    requirement,
    required,
    completed,
    current: totals.current,
    planned: totals.planned,
    state,
    gap: Math.max(0, required - totals.completed - totals.current - totals.planned),
    courses: counting.sort((a, b) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0)),
  };
}

// --- eligibility -----------------------------------------------------------

export type Eligibility =
  | { kind: "recorded"; status: Status }
  | { kind: "eligible" }
  | { kind: "missing"; missing: string[] };

/**
 * Whether the student could take a course next semester. A prerequisite is
 * met when it's completed or being taken now (it'll be done by next
 * semester); a planned prerequisite doesn't count here — the semester plan
 * checks ordering between planned courses.
 */
export function eligibility(course: CatalogCourse, records: StudentRecord[]): Eligibility {
  const byCode = new Map(records.map((record) => [record.code, record]));
  const own = byCode.get(course.code);
  if (own) return { kind: "recorded", status: own.status };
  const missing = course.prerequisites.filter((code) => {
    const status = byCode.get(code)?.status;
    return status !== "completed" && status !== "current";
  });
  return missing.length === 0 ? { kind: "eligible" } : { kind: "missing", missing };
}

/** Courses the student could take in `term`: eligible and offered then. */
export function suggestions(
  catalog: CatalogCourse[],
  records: StudentRecord[],
  term: Term = nextTerm(CURRENT_TERM),
): CatalogCourse[] {
  return catalog.filter(
    (course) =>
      eligibility(course, records).kind === "eligible" && course.sessions.includes(term.session),
  );
}

// --- the semester plan -----------------------------------------------------

export interface PlannedSemester {
  term: Term;
  courses: CatalogCourse[];
  units: number;
  overloaded: boolean;
}

export interface PlanWarning {
  code: string;
  message: string;
}

/** Planned courses grouped by semester, in order. */
export function semesterPlan(catalog: CatalogCourse[], records: StudentRecord[]): PlannedSemester[] {
  const byCode = new Map(catalog.map((course) => [course.code, course]));
  const groups = new Map<string, PlannedSemester>();
  for (const record of records.filter((r) => r.status === "planned")) {
    const course = byCode.get(record.code);
    if (!course) continue;
    const key = termKey(record);
    const group = groups.get(key) ?? {
      term: { year: record.year, session: record.session },
      courses: [],
      units: 0,
      overloaded: false,
    };
    group.courses.push(course);
    group.units += course.units;
    group.overloaded = group.units > FULL_TIME_UNITS;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => compareTerms(a.term, b.term));
}

/**
 * What's wrong with the plan as it stands: a planned course whose
 * prerequisite won't be done before it starts, or one planned in a semester
 * it isn't offered in. Informational — the student decides.
 */
export function planWarnings(catalog: CatalogCourse[], records: StudentRecord[]): PlanWarning[] {
  const byCode = new Map(catalog.map((course) => [course.code, course]));
  const recordByCode = new Map(records.map((record) => [record.code, record]));
  const warnings: PlanWarning[] = [];
  for (const record of records.filter((r) => r.status === "planned")) {
    const course = byCode.get(record.code);
    if (!course) continue;
    for (const prerequisite of course.prerequisites) {
      const done = recordByCode.get(prerequisite);
      const ready =
        done !== undefined &&
        (done.status !== "planned" || compareTerms(done, record) < 0);
      if (!ready) {
        warnings.push({
          code: course.code,
          message:
            done?.status === "planned"
              ? `${course.code} is planned for ${termLabel(record)}, but its prerequisite ${prerequisite} isn't planned until ${termLabel(done)}.`
              : `${course.code} needs ${prerequisite} first, and ${prerequisite} isn't completed, current or planned in an earlier semester.`,
        });
      }
    }
    if (!course.sessions.includes(record.session)) {
      warnings.push({
        code: course.code,
        message: `${course.code} is planned for ${termLabel(record)}, but in this demo catalogue it only runs in ${course.sessions.map(sessionLabel).join(" and ")}.`,
      });
    }
  }
  return warnings;
}
