import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const USER_PLANS = ["free", "premium"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  /** Account entitlement - premium skips Stripe checkout. */
  plan: text("plan", { enum: USER_PLANS }).notNull().default("free"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Courses - one row per generated intensive
// ---------------------------------------------------------------------------

/**
 * Lifecycle of a course row:
 *   generating → ready | failed
 *
 * The row is inserted the moment the multi-agent pipeline starts so the
 * `/dashboard/[courseId]` URL is valid immediately, then finalised with the
 * full module/content hierarchy in a single atomic D1 batch.
 */
export const COURSE_STATUSES = ["generating", "ready", "failed"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetAudience: text("target_audience").notNull(),
    status: text("status", { enum: COURSE_STATUSES })
      .notNull()
      .default("generating"),
    /** Original brain dump the learner submitted (grounds every agent). */
    brainDump: text("brain_dump").notNull(),
    /** Research Agent output - structured factual constraints (JSON). */
    researchFacts: text("research_facts", { mode: "json" }).$type<
      Record<string, unknown> | null
    >(),
    /** Pipeline diagnostics: models used, timings, error (JSON). */
    generationMeta: text("generation_meta", { mode: "json" }).$type<
      Record<string, unknown> | null
    >(),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("courses_user_id_idx").on(table.userId)],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

// ---------------------------------------------------------------------------
// Modules - ordered units inside a course
// ---------------------------------------------------------------------------

export const modules = sqliteTable(
  "modules",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    sequenceOrder: integer("sequence_order").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
  },
  (table) => [
    index("modules_course_id_idx").on(table.courseId),
    index("modules_course_sequence_idx").on(
      table.courseId,
      table.sequenceOrder,
    ),
  ],
);

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

// ---------------------------------------------------------------------------
// Content blocks - polymorphic JSON payload per block type
// ---------------------------------------------------------------------------

export const CONTENT_BLOCK_TYPES = [
  "text",
  "audio",
  "quiz",
  "scenario",
] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export const contentBlocks = sqliteTable(
  "content_blocks",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    sequenceOrder: integer("sequence_order").notNull(),
    type: text("type", { enum: CONTENT_BLOCK_TYPES }).notNull(),
    /**
     * Discriminated by `type` - see `ContentBlockPayload` in `lib/types.ts`
     * for the exact shape of each variant.
     */
    content: text("content", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>(),
    /** Narration URL produced by the TTS Agent (nullable until generated). */
    audioUrl: text("audio_url"),
  },
  (table) => [
    index("content_blocks_module_id_idx").on(table.moduleId),
    index("content_blocks_module_sequence_idx").on(
      table.moduleId,
      table.sequenceOrder,
    ),
  ],
);

export type ContentBlock = typeof contentBlocks.$inferSelect;
export type NewContentBlock = typeof contentBlocks.$inferInsert;

// ---------------------------------------------------------------------------
// Relations - power `db.query.courses.findFirst({ with: { modules: ... } })`
// on the edge without hand-written joins.
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  owner: one(users, {
    fields: [courses.userId],
    references: [users.id],
  }),
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  contentBlocks: many(contentBlocks),
}));

export const contentBlocksRelations = relations(contentBlocks, ({ one }) => ({
  module: one(modules, {
    fields: [contentBlocks.moduleId],
    references: [modules.id],
  }),
}));
