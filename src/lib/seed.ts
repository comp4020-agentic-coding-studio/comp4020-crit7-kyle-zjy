import type { Session, Status } from "./schema";

// The demo dataset. Course codes and titles follow ANU's; the descriptions,
// prerequisites, offerings and the degree's rules are simplified for the
// prototype and are not official — the UI says so on every page.
//
// Inserted at boot when the database is empty (src/lib/db.ts), and the
// student's records are restored by "reset demo".

export const DEMO_DEGREE = {
  code: "BCOMP-DEMO",
  name: "Bachelor of Computing",
  totalUnits: 144,
  description:
    "A three-year, 144-unit computing degree, simplified for this prototype: a computing core, mathematics, computing electives and an advanced-computing requirement, with the rest open to electives from anywhere.",
};

export const DEMO_STUDENT = { name: "Demo student" };

interface SeedCourse {
  code: string;
  title: string;
  description: string;
  sessions: Session[];
  prerequisites: string[];
}

export const DEMO_COURSES: SeedCourse[] = [
  {
    code: "COMP1100",
    title: "Programming as Problem Solving",
    description: "A first course in programming: breaking problems down and expressing solutions as programs.",
    sessions: ["S1", "S2"],
    prerequisites: [],
  },
  {
    code: "COMP1110",
    title: "Structured Programming",
    description: "Designing and building larger programs with objects, data structures and testing.",
    sessions: ["S1", "S2"],
    prerequisites: ["COMP1100"],
  },
  {
    code: "COMP1600",
    title: "Foundations of Computing",
    description: "Logic, proof and the formal models that underpin computation.",
    sessions: ["S2"],
    prerequisites: [],
  },
  {
    code: "COMP2100",
    title: "Software Design Methodologies",
    description: "Software design at scale: abstraction, design patterns and working on a codebase in a team.",
    sessions: ["S2"],
    prerequisites: ["COMP1110"],
  },
  {
    code: "COMP2120",
    title: "Software Engineering",
    description: "The practice of building software with others: requirements, process, quality and tools.",
    sessions: ["S1"],
    prerequisites: ["COMP1110"],
  },
  {
    code: "COMP2300",
    title: "Computer Organisation and Program Execution",
    description: "How programs run on real hardware: machine code, memory and the processor.",
    sessions: ["S2"],
    prerequisites: ["COMP1100"],
  },
  {
    code: "COMP2310",
    title: "Systems, Networks and Concurrency",
    description: "Concurrent and distributed programs, and the operating-system and network services they rely on.",
    sessions: ["S1"],
    prerequisites: ["COMP2300"],
  },
  {
    code: "COMP2400",
    title: "Relational Databases",
    description: "Modelling data relationally, querying it with SQL and designing schemas that hold up.",
    sessions: ["S1"],
    prerequisites: ["COMP1100"],
  },
  {
    code: "COMP2420",
    title: "Introduction to Data Management, Analysis and Security",
    description: "Working with data end to end: storing it, analysing it and keeping it secure.",
    sessions: ["S1"],
    prerequisites: ["COMP1110"],
  },
  {
    code: "COMP3120",
    title: "Managing Software Development",
    description: "Running software projects: planning, estimation, risk and working with clients.",
    sessions: ["S2"],
    prerequisites: ["COMP2120"],
  },
  {
    code: "COMP3310",
    title: "Computer Networks",
    description: "How networks and the internet work, from links and routing to application protocols.",
    sessions: ["S2"],
    prerequisites: ["COMP2310"],
  },
  {
    code: "COMP3600",
    title: "Algorithms",
    description: "Designing and analysing algorithms and data structures, and reasoning about their cost.",
    sessions: ["S2"],
    prerequisites: ["COMP1600", "COMP2100"],
  },
  {
    code: "COMP3620",
    title: "Artificial Intelligence",
    description: "Search, reasoning, planning and learning: the core techniques of AI.",
    sessions: ["S1"],
    prerequisites: ["COMP3600"],
  },
  {
    code: "COMP3900",
    title: "Human-Computer Interface Design and Evaluation",
    description: "Designing interfaces around people, and evaluating whether they work.",
    sessions: ["S2"],
    prerequisites: ["COMP2100"],
  },
  {
    code: "COMP4020",
    title: "Agentic Coding Studio",
    description: "Rapidly prototyping web applications with LLM-based coding agents, in a studio format.",
    sessions: ["S2"],
    prerequisites: ["COMP2100", "COMP2120"],
  },
  {
    code: "MATH1005",
    title: "Discrete Mathematical Models",
    description: "Sets, logic, counting, graphs and the discrete structures computing is built on.",
    sessions: ["S1", "S2"],
    prerequisites: [],
  },
  {
    code: "MATH1013",
    title: "Mathematics and Applications 1",
    description: "Calculus and linear algebra, with applications.",
    sessions: ["S1", "S2"],
    prerequisites: [],
  },
  {
    code: "STAT1003",
    title: "Statistical Techniques",
    description: "Collecting, summarising and drawing conclusions from data.",
    sessions: ["S1", "S2"],
    prerequisites: [],
  },
  {
    code: "ECON1101",
    title: "Microeconomics 1",
    description: "How individuals and firms make decisions, and how markets work.",
    sessions: ["S1", "S2"],
    prerequisites: [],
  },
];

interface SeedRequirement {
  name: string;
  description: string;
  requiredUnits: number;
  rule: "list" | "level";
  courseCodes?: string[];
  codePrefix?: string;
  minLevel?: number;
}

export const DEMO_REQUIREMENTS: SeedRequirement[] = [
  {
    name: "Computing core",
    description: "All six core computing courses.",
    requiredUnits: 36,
    rule: "list",
    courseCodes: ["COMP1100", "COMP1110", "COMP1600", "COMP2100", "COMP2120", "COMP2300"],
  },
  {
    name: "Mathematics and statistics",
    description: "12 units from the mathematics and statistics list.",
    requiredUnits: 12,
    rule: "list",
    courseCodes: ["MATH1005", "MATH1013", "STAT1003"],
  },
  {
    name: "Computing electives",
    description: "24 units from the computing electives list.",
    requiredUnits: 24,
    rule: "list",
    courseCodes: [
      "COMP2310",
      "COMP2400",
      "COMP2420",
      "COMP3120",
      "COMP3310",
      "COMP3600",
      "COMP3620",
      "COMP3900",
      "COMP4020",
    ],
  },
  {
    name: "Advanced computing",
    description: "24 units of COMP courses at 3000 level or above. These can also count toward the lists above.",
    requiredUnits: 24,
    rule: "level",
    codePrefix: "COMP",
    minLevel: 3000,
  },
];

interface SeedRecord {
  code: string;
  status: Status;
  year: number;
  session: Session;
}

// A second-year student midway through the degree: some requirements done,
// some under way, some not started; one course planned for next semester.
export const DEMO_RECORDS: SeedRecord[] = [
  { code: "COMP1100", status: "completed", year: 2025, session: "S1" },
  { code: "MATH1005", status: "completed", year: 2025, session: "S1" },
  { code: "STAT1003", status: "completed", year: 2025, session: "S1" },
  { code: "ECON1101", status: "completed", year: 2025, session: "S1" },
  { code: "COMP1110", status: "completed", year: 2025, session: "S2" },
  { code: "COMP1600", status: "completed", year: 2025, session: "S2" },
  { code: "MATH1013", status: "completed", year: 2026, session: "S1" },
  { code: "COMP2100", status: "current", year: 2026, session: "S2" },
  { code: "COMP2300", status: "current", year: 2026, session: "S2" },
  { code: "COMP2120", status: "planned", year: 2027, session: "S1" },
];
