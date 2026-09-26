import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  courseOfferings,
  coursePrerequisites,
  courses,
  degreeRequirements,
  degrees,
  type Message,
  messages,
  requirementCourses,
  studentCourses,
  students,
} from "./schema";
import { DEMO_COURSES, DEMO_DEGREE, DEMO_RECORDS, DEMO_REQUIREMENTS, DEMO_STUDENT } from "./seed";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
// the schema's foreign keys only hold if SQLite is told to enforce them
client.pragma("foreign_keys = ON");

export const db = drizzle(client);
export type Db = typeof db;

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

// The demo data goes in once, into an empty database. After that the volume
// holds whatever the student has done; nothing here overwrites it.
seedIfEmpty();

function seedIfEmpty(): void {
  if (db.select({ id: degrees.id }).from(degrees).limit(1).get()) return;
  db.transaction((tx) => {
    const degree = tx.insert(degrees).values(DEMO_DEGREE).returning().get();
    const ids = new Map<string, number>();
    for (const course of DEMO_COURSES) {
      const row = tx
        .insert(courses)
        .values({ code: course.code, title: course.title, units: 6, description: course.description })
        .returning()
        .get();
      ids.set(course.code, row.id);
    }
    const idOf = (code: string): number => {
      const id = ids.get(code);
      if (id === undefined) throw new Error(`seed refers to unknown course ${code}`);
      return id;
    };
    for (const course of DEMO_COURSES) {
      for (const session of course.sessions) {
        tx.insert(courseOfferings).values({ courseId: idOf(course.code), session }).run();
      }
      for (const prerequisite of course.prerequisites) {
        tx.insert(coursePrerequisites)
          .values({ courseId: idOf(course.code), prerequisiteId: idOf(prerequisite) })
          .run();
      }
    }
    DEMO_REQUIREMENTS.forEach((requirement, position) => {
      const row = tx
        .insert(degreeRequirements)
        .values({
          degreeId: degree.id,
          position,
          name: requirement.name,
          description: requirement.description,
          rule: requirement.rule,
          requiredUnits: requirement.requiredUnits,
          codePrefix: requirement.codePrefix ?? null,
          minLevel: requirement.minLevel ?? null,
        })
        .returning()
        .get();
      for (const code of requirement.courseCodes ?? []) {
        tx.insert(requirementCourses).values({ requirementId: row.id, courseId: idOf(code) }).run();
      }
    });
    const student = tx.insert(students).values({ ...DEMO_STUDENT, degreeId: degree.id }).returning().get();
    for (const record of DEMO_RECORDS) {
      tx.insert(studentCourses)
        .values({ studentId: student.id, courseId: idOf(record.code), status: record.status, year: record.year, session: record.session })
        .run();
    }
  });
}

/** Put the demo student's records back to the seed state. */
export function resetDemoRecords(studentId: number): void {
  db.transaction((tx) => {
    tx.delete(studentCourses).where(eq(studentCourses.studentId, studentId)).run();
    const ids = new Map(tx.select({ id: courses.id, code: courses.code }).from(courses).all().map((c) => [c.code, c.id]));
    for (const record of DEMO_RECORDS) {
      const courseId = ids.get(record.code);
      if (courseId === undefined) continue;
      tx.insert(studentCourses)
        .values({ studentId, courseId, status: record.status, year: record.year, session: record.session })
        .run();
    }
  });
}

export type { Message };

export function listMessages(): Message[] {
  return db.select().from(messages).orderBy(desc(messages.id)).limit(50).all();
}

export function addMessage(body: string): Message {
  return db.insert(messages).values({ body }).returning().get();
}
