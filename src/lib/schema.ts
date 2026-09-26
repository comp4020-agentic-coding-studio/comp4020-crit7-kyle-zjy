import { sql } from "drizzle-orm";
import { check, int, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
// --- the degree planner ----------------------------------------------------
//
// Only facts are stored. Everything the dashboard shows — units completed,
// requirement progress, remaining units, a course's level, whether it's
// eligible — is derived from these rows in src/lib/planner.ts.

export const SESSIONS = ["S1", "S2"] as const;
export type Session = (typeof SESSIONS)[number];

export const STATUSES = ["completed", "current", "planned"] as const;
export type Status = (typeof STATUSES)[number];

// How a requirement decides which courses count toward it:
//   list  — the courses joined to it in requirement_courses
//   level — any course with the given code prefix at or above min_level
export const RULES = ["list", "level"] as const;
export type Rule = (typeof RULES)[number];

export const degrees = sqliteTable("degrees", {
  id: int().primaryKey({ autoIncrement: true }),
  code: text().notNull().unique(),
  name: text().notNull(),
  totalUnits: int("total_units").notNull(),
  description: text().notNull(),
});

export const courses = sqliteTable(
  "courses",
  {
    id: int().primaryKey({ autoIncrement: true }),
    // e.g. COMP2100; the level (2000) is read off the code, not stored
    code: text().notNull().unique(),
    title: text().notNull(),
    units: int().notNull(),
    description: text().notNull(),
  },
  (t) => [check("courses_code_shape", sql`${t.code} GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]'`)],
);

// Which sessions a course runs in: a row per (course, session), so a course
// offered in both semesters has two rows rather than a "S1,S2" string.
export const courseOfferings = sqliteTable(
  "course_offerings",
  {
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    session: text({ enum: SESSIONS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.session] }),
    check("course_offerings_session", sql`${t.session} IN ('S1', 'S2')`),
  ],
);

// Direct prerequisites only: every listed course must be done first. The
// real Programs & Courses grammar (or-groups, co-requisites, incompatible
// courses, unit thresholds) is deliberately out of scope.
export const coursePrerequisites = sqliteTable(
  "course_prerequisites",
  {
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prerequisiteId: int("prerequisite_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.prerequisiteId] }),
    check("course_prerequisites_not_self", sql`${t.courseId} <> ${t.prerequisiteId}`),
  ],
);

export const degreeRequirements = sqliteTable(
  "degree_requirements",
  {
    id: int().primaryKey({ autoIncrement: true }),
    degreeId: int("degree_id")
      .notNull()
      .references(() => degrees.id, { onDelete: "cascade" }),
    // display order on the dashboard
    position: int().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    rule: text({ enum: RULES }).notNull(),
    requiredUnits: int("required_units").notNull(),
    // only for rule = 'level'
    codePrefix: text("code_prefix"),
    minLevel: int("min_level"),
  },
  (t) => [
    check("degree_requirements_rule", sql`${t.rule} IN ('list', 'level')`),
    check(
      "degree_requirements_level_fields",
      sql`(${t.rule} = 'level') = (${t.codePrefix} IS NOT NULL AND ${t.minLevel} IS NOT NULL)`,
    ),
    check("degree_requirements_units", sql`${t.requiredUnits} > 0`),
  ],
);

export const requirementCourses = sqliteTable(
  "requirement_courses",
  {
    requirementId: int("requirement_id")
      .notNull()
      .references(() => degreeRequirements.id, { onDelete: "cascade" }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.requirementId, t.courseId] })],
);

export const students = sqliteTable("students", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  degreeId: int("degree_id")
    .notNull()
    .references(() => degrees.id),
});

// The student's relationship with a course: one row per course, so a course
// is completed OR current OR planned, never two at once. The term says when:
// the semester it was done in, is being done in, or is planned for.
export const studentCourses = sqliteTable(
  "student_courses",
  {
    id: int().primaryKey({ autoIncrement: true }),
    studentId: int("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: text({ enum: STATUSES }).notNull(),
    year: int().notNull(),
    session: text({ enum: SESSIONS }).notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    unique("student_courses_one_per_course").on(t.studentId, t.courseId),
    check("student_courses_status", sql`${t.status} IN ('completed', 'current', 'planned')`),
    check("student_courses_session", sql`${t.session} IN ('S1', 'S2')`),
  ],
);

export type Degree = typeof degrees.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type DegreeRequirement = typeof degreeRequirements.$inferSelect;
export type Student = typeof students.$inferSelect;
export type StudentCourse = typeof studentCourses.$inferSelect;
