import { and, asc, eq, sql } from "drizzle-orm";
import { db, resetDemoRecords } from "./db";
import type { CatalogCourse, Requirement, StudentRecord, Term } from "./planner";
import {
  courseOfferings,
  coursePrerequisites,
  courses,
  degreeRequirements,
  degrees,
  requirementCourses,
  type Status,
  studentCourses,
  students,
} from "./schema";

// Reads and writes for the planner. Reads return plain rows shaped for
// src/lib/planner.ts, which derives everything the pages show; writes change
// only the student's own records.

export interface PlannerData {
  student: { id: number; name: string };
  degree: { code: string; name: string; totalUnits: number; description: string };
  catalog: CatalogCourse[];
  requirements: Requirement[];
  records: StudentRecord[];
}

/** The one demo student. There's no login, so every visitor shares them. */
function demoStudent() {
  const student = db.select().from(students).orderBy(asc(students.id)).limit(1).get();
  if (!student) throw new Error("no student in the database — has the seed run?");
  return student;
}

export function loadCatalog(): CatalogCourse[] {
  const rows = db.select().from(courses).orderBy(asc(courses.code)).all();
  const sessions = db.select().from(courseOfferings).orderBy(asc(courseOfferings.session)).all();
  const codeById = new Map(rows.map((row) => [row.id, row.code]));
  const prerequisites = db.select().from(coursePrerequisites).all();
  return rows.map((row) => ({
    code: row.code,
    title: row.title,
    units: row.units,
    description: row.description,
    sessions: sessions.filter((s) => s.courseId === row.id).map((s) => s.session),
    prerequisites: prerequisites
      .filter((p) => p.courseId === row.id)
      .map((p) => codeById.get(p.prerequisiteId) ?? "")
      .filter(Boolean)
      .sort(),
  }));
}

export function loadPlanner(): PlannerData {
  const student = demoStudent();
  const degree = db.select().from(degrees).where(eq(degrees.id, student.degreeId)).get();
  if (!degree) throw new Error(`student ${student.id} has no degree`);

  const requirementRows = db
    .select()
    .from(degreeRequirements)
    .where(eq(degreeRequirements.degreeId, degree.id))
    .orderBy(asc(degreeRequirements.position))
    .all();
  const listed = db
    .select({ requirementId: requirementCourses.requirementId, code: courses.code })
    .from(requirementCourses)
    .innerJoin(courses, eq(courses.id, requirementCourses.courseId))
    .all();

  const records = db
    .select({
      code: courses.code,
      status: studentCourses.status,
      year: studentCourses.year,
      session: studentCourses.session,
    })
    .from(studentCourses)
    .innerJoin(courses, eq(courses.id, studentCourses.courseId))
    .where(eq(studentCourses.studentId, student.id))
    .orderBy(asc(studentCourses.year), asc(studentCourses.session), asc(courses.code))
    .all();

  return {
    student: { id: student.id, name: student.name },
    degree: {
      code: degree.code,
      name: degree.name,
      totalUnits: degree.totalUnits,
      description: degree.description,
    },
    catalog: loadCatalog(),
    requirements: requirementRows.map((row) => ({
      name: row.name,
      description: row.description,
      requiredUnits: row.requiredUnits,
      rule: row.rule,
      courseCodes: listed.filter((l) => l.requirementId === row.id).map((l) => l.code),
      codePrefix: row.codePrefix,
      minLevel: row.minLevel,
    })),
    records,
  };
}

function courseId(code: string): number | undefined {
  return db.select({ id: courses.id }).from(courses).where(eq(courses.code, code)).get()?.id;
}

/**
 * Record a course as completed, current or planned for the demo student:
 * one row per course, so this inserts or moves the existing row. Returns
 * false if the course doesn't exist.
 */
export function setCourseStatus(code: string, status: Status, term: Term): boolean {
  const id = courseId(code);
  if (id === undefined) return false;
  const student = demoStudent();
  db.insert(studentCourses)
    .values({ studentId: student.id, courseId: id, status, year: term.year, session: term.session })
    .onConflictDoUpdate({
      target: [studentCourses.studentId, studentCourses.courseId],
      set: { status, year: term.year, session: term.session, updatedAt: sql`(datetime('now'))` },
    })
    .run();
  return true;
}

/** Drop a course from the demo student's records. False if it wasn't there. */
export function removeCourse(code: string): boolean {
  const id = courseId(code);
  if (id === undefined) return false;
  const student = demoStudent();
  const result = db
    .delete(studentCourses)
    .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, id)))
    .run();
  return result.changes > 0;
}

export function resetDemo(): void {
  resetDemoRecords(demoStudent().id);
}
