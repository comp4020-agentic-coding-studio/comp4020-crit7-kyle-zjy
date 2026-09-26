CREATE TABLE `course_offerings` (
	`course_id` integer NOT NULL,
	`session` text NOT NULL,
	PRIMARY KEY(`course_id`, `session`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "course_offerings_session" CHECK("course_offerings"."session" IN ('S1', 'S2'))
);
--> statement-breakpoint
CREATE TABLE `course_prerequisites` (
	`course_id` integer NOT NULL,
	`prerequisite_id` integer NOT NULL,
	PRIMARY KEY(`course_id`, `prerequisite_id`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prerequisite_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "course_prerequisites_not_self" CHECK("course_prerequisites"."course_id" <> "course_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`units` integer NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT "courses_code_shape" CHECK("courses"."code" GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_unique` ON `courses` (`code`);--> statement-breakpoint
CREATE TABLE `degree_requirements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`degree_id` integer NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`rule` text NOT NULL,
	`required_units` integer NOT NULL,
	`code_prefix` text,
	`min_level` integer,
	FOREIGN KEY (`degree_id`) REFERENCES `degrees`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "degree_requirements_rule" CHECK("degree_requirements"."rule" IN ('list', 'level')),
	CONSTRAINT "degree_requirements_level_fields" CHECK(("degree_requirements"."rule" = 'level') = ("degree_requirements"."code_prefix" IS NOT NULL AND "degree_requirements"."min_level" IS NOT NULL)),
	CONSTRAINT "degree_requirements_units" CHECK("degree_requirements"."required_units" > 0)
);
--> statement-breakpoint
CREATE TABLE `degrees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`total_units` integer NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `degrees_code_unique` ON `degrees` (`code`);--> statement-breakpoint
CREATE TABLE `requirement_courses` (
	`requirement_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	PRIMARY KEY(`requirement_id`, `course_id`),
	FOREIGN KEY (`requirement_id`) REFERENCES `degree_requirements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `student_courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`status` text NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "student_courses_status" CHECK("student_courses"."status" IN ('completed', 'current', 'planned')),
	CONSTRAINT "student_courses_session" CHECK("student_courses"."session" IN ('S1', 'S2'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_courses_one_per_course` ON `student_courses` (`student_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`degree_id` integer NOT NULL,
	FOREIGN KEY (`degree_id`) REFERENCES `degrees`(`id`) ON UPDATE no action ON DELETE no action
);
