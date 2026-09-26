import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// The planner's promises, checked over HTTP against the built server with
// its throwaway database — the same way a browser drives it: a form POST,
// a 303, and a fresh page load that must reflect what's now in SQLite.
//
// This is the only spec file that changes the demo student, and it resets
// them first, so its expectations start from the seed (src/lib/seed.ts).
const baseUrl = inject("baseUrl");

// Astro refuses form POSTs without a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const post = (path: string, fields: Record<string, string>, origin = baseUrl) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

const change = (course: string, action: string, extra: Record<string, string> = {}) =>
  post("/api/courses", { course, action, returnTo: "/", ...extra });

const page = async (path = "/"): Promise<Document> => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};

const statusOf = (doc: Document, code: string) =>
  doc.querySelector(`.course-row[data-course="${code}"][data-status]`)?.getAttribute("data-status") ?? null;

const units = (doc: Document, testid: string) =>
  Number.parseInt(doc.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "NaN", 10);

const requirement = (doc: Document, name: string) => {
  const row = doc.querySelector(`.requirement[data-requirement="${name}"]`);
  return {
    state: row?.getAttribute("data-state"),
    completed: Number(row?.querySelector('[data-testid="requirement-completed"]')?.textContent),
  };
};

describe("planner", () => {
  beforeAll(async () => {
    const res = await post("/api/reset", {});
    expect(res.status).toBe(303);
  });

  it("starts from the seeded demo student", async () => {
    const doc = await page();
    expect(units(doc, "total-completed")).toBe(42);
    expect(units(doc, "total-current")).toBe(12);
    expect(statusOf(doc, "COMP2100")).toBe("current");
    expect(statusOf(doc, "COMP2420")).toBeNull();
  });

  it("adds a course to the plan, and it's still planned after a reload", async () => {
    const res = await change("COMP2420", "plan", { term: "2027-S1" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?done=planned&course=COMP2420&term=2027-S1");

    // the page the redirect lands on, then a separate reload
    for (let load = 0; load < 2; load++) {
      const doc = await page();
      expect(statusOf(doc, "COMP2420")).toBe("planned");
      expect(doc.querySelector('.course-row[data-course="COMP2420"]')?.textContent).toContain("Semester 1, 2027");
    }
  });

  it("confirms the change on the page it redirects to", async () => {
    const doc = await page("/?done=planned&course=COMP2420&term=2027-S1");
    expect(doc.querySelector('[role="status"]')?.textContent).toContain("COMP2420 added to your plan");
  });

  it("recalculates units and requirement progress when a course is completed", async () => {
    const before = await page();
    expect(requirement(before, "Computing core")).toEqual({ state: "in-progress", completed: 18 });

    expect((await change("COMP2100", "complete")).status).toBe(303);

    const after = await page();
    expect(statusOf(after, "COMP2100")).toBe("completed");
    expect(units(after, "total-completed")).toBe(48);
    expect(units(after, "total-current")).toBe(6);
    expect(requirement(after, "Computing core")).toEqual({ state: "in-progress", completed: 24 });
  });

  it("moves a planned course to current", async () => {
    expect((await change("COMP2420", "current")).status).toBe(303);
    const doc = await page();
    expect(statusOf(doc, "COMP2420")).toBe("current");
  });

  it("removes a course from the student's records", async () => {
    expect((await change("COMP2420", "remove")).status).toBe(303);
    const doc = await page();
    expect(statusOf(doc, "COMP2420")).toBeNull();
  });

  it("suggests only courses whose prerequisites are met", async () => {
    const doc = await page();
    const suggested = [...doc.querySelectorAll('[data-testid="suggestions"] [data-course]')].map((el) =>
      el.getAttribute("data-course"),
    );
    // COMP1110 is completed, so COMP2420 is open; COMP3620 needs COMP3600
    expect(suggested).toContain("COMP2420");
    expect(suggested).not.toContain("COMP3620");
    expect(doc.querySelector('[data-testid="blocked"] [data-course="COMP3620"]')?.textContent).toContain(
      "Missing prerequisite: COMP3600",
    );
  });

  it("rejects a course that isn't in the catalogue, changing nothing", async () => {
    const res = await change("COMP9999", "plan", { term: "2027-S1" });
    expect(res.headers.get("location")).toBe("/?error=unknown-course");
    const doc = await page("/?error=unknown-course");
    expect(doc.querySelector('[role="alert"]')?.textContent).toContain("isn't in the catalogue");
    expect(statusOf(doc, "COMP9999")).toBeNull();
  });

  it("rejects a plan for a semester outside the planning window", async () => {
    const res = await change("COMP2400", "plan", { term: "2031-S1" });
    expect(res.headers.get("location")).toBe("/?error=bad-term");
    expect(statusOf(await page(), "COMP2400")).toBeNull();
  });

  it("refuses a cross-site form POST", async () => {
    const res = await post(
      "/api/courses",
      { course: "COMP2400", action: "plan", term: "2027-S1", returnTo: "/" },
      "https://cross-site.example.com",
    );
    expect(res.status).toBe(403);
    expect(statusOf(await page(), "COMP2400")).toBeNull();
  });

  it("never redirects off-site, whatever returnTo says", async () => {
    const res = await change("COMP2400", "bogus", { returnTo: "//evil.example.com/" });
    expect(res.headers.get("location")).toBe("/?error=bad-action");
  });

  it("restores the seed state on reset", async () => {
    expect((await post("/api/reset", {})).status).toBe(303);
    const doc = await page();
    expect(units(doc, "total-completed")).toBe(42);
    expect(statusOf(doc, "COMP2100")).toBe("current");
  });
});
