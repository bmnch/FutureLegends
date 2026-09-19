import { and, asc, eq } from "drizzle-orm";
import type {
  ContentBlockPayload,
  PlayerCourse,
  ResearchFacts,
} from "@/lib/types";
import type { Database } from "@/src/db";
import { contentBlocks, courses, modules } from "@/src/db/schema";

/**
 * Load a course with its full module → block hierarchy, scoped to the owner.
 * Uses Drizzle's relational query API (enabled by the `relations()` exports in
 * the schema) so the whole tree comes back from D1 in one round-trip.
 */
export async function getPlayerCourse(
  db: Database,
  courseId: string,
  userId: string,
): Promise<PlayerCourse | null> {
  const row = await db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    with: {
      modules: {
        orderBy: [asc(modules.sequenceOrder)],
        with: {
          contentBlocks: {
            orderBy: [asc(contentBlocks.sequenceOrder)],
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    targetAudience: row.targetAudience,
    status: row.status,
    generatedAt: row.generatedAt.toISOString(),
    researchFacts: (row.researchFacts as unknown as ResearchFacts | null) ?? null,
    generationMeta: row.generationMeta ?? null,
    modules: row.modules.map((m) => ({
      id: m.id,
      sequenceOrder: m.sequenceOrder,
      title: m.title,
      objective: m.objective,
      blocks: m.contentBlocks.map((b) => ({
        id: b.id,
        sequenceOrder: b.sequenceOrder,
        type: b.type,
        content: b.content as unknown as ContentBlockPayload,
        audioUrl: b.audioUrl,
      })),
    })),
  };
}

/** Lightweight ownership + status check (no hierarchy). */
export async function getCourseSummary(
  db: Database,
  courseId: string,
  userId: string,
) {
  return db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    columns: {
      id: true,
      title: true,
      status: true,
      brainDump: true,
      researchFacts: true,
    },
  });
}

/** Load one module with its blocks, verifying it belongs to the user's course. */
export async function getModuleForChat(
  db: Database,
  courseId: string,
  moduleId: string,
  userId: string,
) {
  const course = await db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.userId, userId)),
    columns: { id: true, title: true, targetAudience: true, researchFacts: true },
    with: {
      modules: {
        where: eq(modules.id, moduleId),
        with: {
          contentBlocks: { orderBy: [asc(contentBlocks.sequenceOrder)] },
        },
      },
    },
  });

  const target = course?.modules[0];
  if (!course || !target) return null;

  return {
    course: {
      id: course.id,
      title: course.title,
      targetAudience: course.targetAudience,
      researchFacts: course.researchFacts as unknown as ResearchFacts | null,
    },
    module: {
      id: target.id,
      title: target.title,
      objective: target.objective,
      blocks: target.contentBlocks.map((b) => ({
        id: b.id,
        type: b.type,
        content: b.content as unknown as ContentBlockPayload,
      })),
    },
  };
}
