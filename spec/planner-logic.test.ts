import { describe, expect, it } from "vitest";
import {
  type CatalogCourse,
  type Requirement,
  type StudentRecord,
  degreeProgress,
  eligibility,
  levelOf,
  planWarnings,
  planningTerms,
  requirementProgress,
  semesterPlan,
  suggestions,
} from "../src/lib/planner";

// The derivations behind every number the planner shows, tested on
// hand-built rows rather than the seed, so each case says exactly what it's
// about. The HTTP-level promises live in planner.test.ts.

const course = (code: string, prerequisites: string[] = [], sessions: ("S1" | "S2")[] = ["S1", "S2"]): CatalogCourse => ({
  code,
  title: code,
  units: 6,
  description: "",
  sessions,
  prerequisites,
});

const record = (code: string, status: StudentRecord["status"], year = 2026, session: "S1" | "S2" = "S1"): StudentRecord => ({
  code,
  status,
  year,
  session,
});

const listRequirement = (codes: string[], requiredUnits: number): Requirement => ({
  name: "List",
  description: "",
  requiredUnits,
  rule: "list",
  courseCodes: codes,
  codePrefix: null,
  minLevel: null,
});

const levelRequirement = (requiredUnits: number): Requirement => ({
  name: "Advanced",
  description: "",
  requiredUnits,
  rule: "level",
  courseCodes: [],
  codePrefix: "COMP",
  minLevel: 3000,
});

const catalog = ["COMP1100", "COMP1110", "COMP2100", "COMP3600", "COMP3620", "MATH3000", "COMP4020"].map((c) =>
  course(c),
);

describe("terms and levels", () => {
  it("reads a course's level off its code", () => {
    expect(levelOf("COMP1100")).toBe(1000);
    expect(levelOf("COMP4020")).toBe(4000);
  });

  it("offers the four semesters after the current one", () => {
    expect(planningTerms(4, { year: 2026, session: "S2" })).toEqual([
      { year: 2027, session: "S1" },
      { year: 2027, session: "S2" },
      { year: 2028, session: "S1" },
      { year: 2028, session: "S2" },
    ]);
  });
});

describe("degree progress", () => {
  it("totals units by status and works out what's left", () => {
    const records = [record("COMP1100", "completed"), record("COMP1110", "current"), record("COMP2100", "planned")];
    expect(degreeProgress(144, catalog, records)).toEqual({
      completed: 6,
      current: 6,
      planned: 6,
      total: 144,
      toComplete: 138,
      unplanned: 126,
      percentComplete: 4,
    });
  });

  it("starts from nothing with no records", () => {
    const progress = degreeProgress(144, catalog, []);
    expect(progress.completed).toBe(0);
    expect(progress.unplanned).toBe(144);
    expect(progress.percentComplete).toBe(0);
  });
});

describe("requirement progress", () => {
  it("counts only the listed courses toward a list requirement", () => {
    const records = [record("COMP1100", "completed"), record("COMP3600", "completed")];
    const progress = requirementProgress(listRequirement(["COMP1100", "COMP1110"], 12), catalog, records);
    expect(progress.completed).toBe(6);
    expect(progress.courses.map((r) => r.code)).toEqual(["COMP1100"]);
  });

  it("counts courses by prefix and level toward a level requirement", () => {
    const records = ["COMP2100", "COMP3600", "MATH3000", "COMP4020"].map((c) => record(c, "completed"));
    const progress = requirementProgress(levelRequirement(24), catalog, records);
    // COMP2100 is below 3000; MATH3000 has the wrong prefix
    expect(progress.courses.map((r) => r.code)).toEqual(["COMP3600", "COMP4020"]);
    expect(progress.completed).toBe(12);
  });

  it("lets one course count toward two requirements", () => {
    const records = [record("COMP3600", "completed")];
    expect(requirementProgress(listRequirement(["COMP3600"], 6), catalog, records).completed).toBe(6);
    expect(requirementProgress(levelRequirement(24), catalog, records).completed).toBe(6);
  });

  it("is complete once completed units reach the requirement, and caps there", () => {
    const records = ["COMP1100", "COMP1110", "COMP2100"].map((c) => record(c, "completed"));
    const progress = requirementProgress(listRequirement(["COMP1100", "COMP1110", "COMP2100"], 12), catalog, records);
    expect(progress.state).toBe("complete");
    expect(progress.completed).toBe(12);
    expect(progress.gap).toBe(0);
  });

  it("is in progress when a course is only being taken now", () => {
    const records = [record("COMP1100", "current")];
    const progress = requirementProgress(listRequirement(["COMP1100", "COMP1110"], 12), catalog, records);
    expect(progress.state).toBe("in-progress");
    expect(progress.completed).toBe(0);
  });

  it("is not started when only planned, but the plan closes the gap", () => {
    const records = [record("COMP1100", "planned"), record("COMP1110", "planned")];
    const progress = requirementProgress(listRequirement(["COMP1100", "COMP1110"], 12), catalog, records);
    expect(progress.state).toBe("not-started");
    expect(progress.gap).toBe(0);
  });
});

describe("eligibility", () => {
  const withPrereq = course("COMP2100", ["COMP1110"]);

  it("is met by a completed prerequisite", () => {
    expect(eligibility(withPrereq, [record("COMP1110", "completed")])).toEqual({ kind: "eligible" });
  });

  it("is met by a prerequisite being taken now", () => {
    expect(eligibility(withPrereq, [record("COMP1110", "current")])).toEqual({ kind: "eligible" });
  });

  it("names the missing prerequisite, and a planned one doesn't count", () => {
    expect(eligibility(withPrereq, [])).toEqual({ kind: "missing", missing: ["COMP1110"] });
    expect(eligibility(withPrereq, [record("COMP1110", "planned")])).toEqual({ kind: "missing", missing: ["COMP1110"] });
  });

  it("reports a course the student already has instead", () => {
    expect(eligibility(withPrereq, [record("COMP2100", "completed")])).toEqual({ kind: "recorded", status: "completed" });
  });

  it("suggests only eligible courses offered in the target semester", () => {
    const cat = [course("COMP1100"), course("COMP1110", ["COMP1100"], ["S2"]), course("COMP2100", ["COMP1110"])];
    const next = suggestions(cat, [record("COMP1100", "completed")], { year: 2027, session: "S1" });
    // COMP1110 is eligible but runs only in S2; COMP2100 is blocked
    expect(next.map((c) => c.code)).toEqual([]);
    const s2 = suggestions(cat, [record("COMP1100", "completed")], { year: 2027, session: "S2" });
    expect(s2.map((c) => c.code)).toEqual(["COMP1110"]);
  });
});

describe("the semester plan", () => {
  const cat = [course("COMP1110"), course("COMP2100", ["COMP1110"]), course("COMP3900", [], ["S2"])];

  it("warns when a prerequisite is planned for the same semester", () => {
    const records = [record("COMP1110", "planned", 2027, "S1"), record("COMP2100", "planned", 2027, "S1")];
    const warnings = planWarnings(cat, records);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("COMP2100");
    expect(warnings[0].message).toContain("COMP1110");
  });

  it("accepts a prerequisite planned for an earlier semester", () => {
    const records = [record("COMP1110", "planned", 2027, "S1"), record("COMP2100", "planned", 2027, "S2")];
    expect(planWarnings(cat, records)).toEqual([]);
  });

  it("warns when a prerequisite isn't anywhere in the student's records", () => {
    const warnings = planWarnings(cat, [record("COMP2100", "planned", 2027, "S1")]);
    expect(warnings[0].message).toContain("isn't completed, current or planned");
  });

  it("warns when a course is planned in a semester it doesn't run in", () => {
    const warnings = planWarnings(cat, [record("COMP3900", "planned", 2027, "S1")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("only runs in Semester 2");
  });

  it("groups planned courses by semester in order and flags an overload", () => {
    const many = ["COMP1001", "COMP1002", "COMP1003", "COMP1004", "COMP1005"].map((c) => course(c));
    const records = [
      ...many.map((c) => record(c.code, "planned", 2027, "S2")),
      record("COMP1110", "planned", 2027, "S1"),
      record("COMP2100", "completed", 2026, "S1"),
    ];
    const plan = semesterPlan([...cat, ...many], records);
    expect(plan.map((s) => `${s.term.year}-${s.term.session}`)).toEqual(["2027-S1", "2027-S2"]);
    expect(plan[0]).toMatchObject({ units: 6, overloaded: false });
    expect(plan[1]).toMatchObject({ units: 30, overloaded: true });
  });
});
