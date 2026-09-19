import { eq } from "drizzle-orm";
import type {
  ArchitectSyllabus,
  AudioBlockPayload,
  ContentAgentModule,
  GenerationEvent,
  QuizBlockPayload,
  ResearchFacts,
  ScenarioBlockPayload,
  SyllabusOutline,
  TextBlockPayload,
} from "@/lib/types";
import type { Database } from "@/src/db";
import {
  contentBlocks,
  courses,
  modules,
  type NewContentBlock,
  type NewModule,
} from "@/src/db/schema";
import { runArchitectAgent } from "./agents/architect-agent";
import { markdownToPlainText, runContentAgent } from "./agents/content-agent";
import { runResearchAgent } from "./agents/research-agent";
import { generateAudio } from "./agents/tts-agent";

/**
 * Course Generation Orchestrator (supervisor)
 * -------------------------------------------
 * Sequential pipeline with a parallel fan-out in the middle:
 *
 *   Research Agent ──► Architect Agent ──► Content Agent × N (parallel)
 *        │                                        │
 *        └─ factual constraints ──────────────────┘
 *                                                 ▼
 *                                          TTS Agent (per text block)
 *                                                 ▼
 *                                   D1 atomic batch (modules + blocks + status)
 *
 * Progress is reported through `emit()` so the HTTP layer can stream NDJSON to
 * the client while the (potentially multi-minute) job runs.
 */

export type OrchestratorInput = {
  db: Database;
  courseId: string;
  userId: string;
  brainDump: string;
  outline?: SyllabusOutline | null;
  voicePersona?: string;
  emit: (event: GenerationEvent) => void;
  signal?: AbortSignal;
};

export type OrchestratorResult = {
  courseId: string;
  title: string;
  moduleCount: number;
};

type ModuleAssembly = {
  module: NewModule;
  blocks: NewContentBlock[];
};

function nowMs() {
  return Date.now();
}

/**
 * Turn one module's Content Agent output into ordered content_block rows,
 * running the TTS agent for every text block plus a full-module narration.
 */
async function assembleModule(params: {
  courseId: string;
  index: number;
  title: string;
  objective: string;
  content: ContentAgentModule;
  voicePersona: string;
}): Promise<ModuleAssembly> {
  const moduleId = crypto.randomUUID();
  const blocks: NewContentBlock[] = [];
  let order = 0;

  // 1) Text sections (each narrated individually)
  const plainSections: string[] = [];
  for (const section of params.content.sections) {
    const plainText = markdownToPlainText(section.markdown);
    plainSections.push(`${section.title}. ${plainText}`);
    const audio = await generateAudio(`${section.title}. ${plainText}`, {
      voicePersona: params.voicePersona,
    });
    const payload: TextBlockPayload = {
      kind: "text",
      title: section.title,
      markdown: section.markdown,
      plainText,
      narration: audio.meta,
    };
    blocks.push({
      id: crypto.randomUUID(),
      moduleId,
      sequenceOrder: order++,
      type: "text",
      content: payload,
      audioUrl: audio.url,
    });
  }

  // 2) Localized scenario
  const scenarioPayload: ScenarioBlockPayload = {
    kind: "scenario",
    ...params.content.scenario,
  };
  blocks.push({
    id: crypto.randomUUID(),
    moduleId,
    sequenceOrder: order++,
    type: "scenario",
    content: scenarioPayload,
    audioUrl: null,
  });

  // 3) Validation quiz(zes) — gate progression
  for (const quiz of params.content.quizzes) {
    const quizPayload: QuizBlockPayload = {
      kind: "quiz",
      question: quiz.question,
      options: quiz.options,
      explanation: quiz.explanation,
      gate: true,
    };
    blocks.push({
      id: crypto.randomUUID(),
      moduleId,
      sequenceOrder: order++,
      type: "quiz",
      content: quizPayload,
      audioUrl: null,
    });
  }

  // 4) Whole-module narration track for the media bar
  const transcript = plainSections.join("\n\n");
  const narration = await generateAudio(transcript, {
    voicePersona: params.voicePersona,
  });
  const audioPayload: AudioBlockPayload = {
    kind: "audio",
    title: `${params.title} — full narration`,
    transcript,
    narration: narration.meta,
  };
  blocks.push({
    id: crypto.randomUUID(),
    moduleId,
    sequenceOrder: order++,
    type: "audio",
    content: audioPayload,
    audioUrl: narration.url,
  });

  return {
    module: {
      id: moduleId,
      courseId: params.courseId,
      sequenceOrder: params.index,
      title: params.title,
      objective: params.objective,
    },
    blocks,
  };
}

/**
 * Persist the whole hierarchy atomically.
 *
 * D1 has no interactive transactions, so Drizzle's `db.transaction()` is not
 * usable; `db.batch()` executes every statement inside one SQLite transaction
 * and rolls everything back if any statement fails — the semantics we need.
 */
async function persistCourse(params: {
  db: Database;
  courseId: string;
  syllabus: ArchitectSyllabus;
  facts: ResearchFacts;
  assemblies: ModuleAssembly[];
  meta: Record<string, unknown>;
}) {
  const { db, courseId, syllabus, facts, assemblies, meta } = params;

  const statements = [
    ...assemblies.map((a) => db.insert(modules).values(a.module)),
    ...assemblies.flatMap((a) =>
      a.blocks.map((block) => db.insert(contentBlocks).values(block)),
    ),
    db
      .update(courses)
      .set({
        title: syllabus.title,
        targetAudience: syllabus.targetAudience,
        status: "ready",
        researchFacts: facts as unknown as Record<string, unknown>,
        generationMeta: meta,
        generatedAt: new Date(),
      })
      .where(eq(courses.id, courseId)),
  ] as const;

  // `batch` requires a non-empty tuple type; we always have ≥1 statement.
  await db.batch(
    statements as unknown as [
      (typeof statements)[number],
      ...(typeof statements)[number][],
    ],
  );
}

export async function markCourseFailed(
  db: Database,
  courseId: string,
  message: string,
  meta: Record<string, unknown> = {},
) {
  await db
    .update(courses)
    .set({
      status: "failed",
      generationMeta: { ...meta, error: message, failedAt: new Date().toISOString() },
    })
    .where(eq(courses.id, courseId));
}

export async function runCourseGeneration(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { db, courseId, brainDump, emit, signal } = input;
  const voicePersona = input.voicePersona ?? "professional";
  const startedAt = nowMs();
  const timings: Record<string, number> = {};
  const modelsUsed: Record<string, string | string[]> = {};

  const throwIfAborted = () => {
    if (signal?.aborted) throw new Error("Generation cancelled by client.");
  };

  // ── 1. Research Agent ────────────────────────────────────────────────────
  emit({ type: "stage", stage: "research", status: "running" });
  const researchStart = nowMs();
  const { facts, model: researchModel } = await runResearchAgent({
    brainDump,
    outline: input.outline,
    signal,
  });
  timings.researchMs = nowMs() - researchStart;
  modelsUsed.research = researchModel;
  emit({
    type: "stage",
    stage: "research",
    status: "done",
    detail: `${facts.constraints.length} factual constraints · locale ${[facts.locale.city, facts.locale.region, facts.locale.country].filter(Boolean).join(", ") || "unresolved"}`,
  });
  throwIfAborted();

  // ── 2. Architect Agent ───────────────────────────────────────────────────
  emit({ type: "stage", stage: "architect", status: "running" });
  const architectStart = nowMs();
  const { syllabus, model: architectModel } = await runArchitectAgent({
    brainDump,
    facts,
    outline: input.outline,
    signal,
  });
  timings.architectMs = nowMs() - architectStart;
  modelsUsed.architect = architectModel;
  emit({
    type: "stage",
    stage: "architect",
    status: "done",
    detail: `${syllabus.modules.length} modules · "${syllabus.title}"`,
  });
  throwIfAborted();

  // Update title early so the dashboard shows something meaningful while
  // content is still being written.
  await db
    .update(courses)
    .set({ title: syllabus.title, targetAudience: syllabus.targetAudience })
    .where(eq(courses.id, courseId));

  // ── 3. Content Agents (parallel fan-out) ─────────────────────────────────
  emit({ type: "stage", stage: "content", status: "running" });
  const contentStart = nowMs();
  const total = syllabus.modules.length;
  const contentModels: string[] = [];

  const moduleContents = await Promise.all(
    syllabus.modules.map(async (module, index) => {
      emit({ type: "module", index, total, title: module.title, status: "running" });
      const result = await runContentAgent({
        brainDump,
        facts,
        syllabus,
        module,
        moduleIndex: index,
        signal,
        onRetry: (attempt, reason) => {
          emit({ type: "module", index, total, title: module.title, status: "retrying" });
          emit({ type: "log", message: `Module ${index + 1} attempt ${attempt} rejected: ${reason}` });
        },
      });
      contentModels[index] = result.model;
      emit({ type: "module", index, total, title: module.title, status: "done" });
      return result.content;
    }),
  );
  timings.contentMs = nowMs() - contentStart;
  modelsUsed.content = contentModels;
  emit({ type: "stage", stage: "content", status: "done", detail: `${total} modules written in parallel` });
  throwIfAborted();

  // ── 4. TTS Agent + block assembly ────────────────────────────────────────
  emit({ type: "stage", stage: "audio", status: "running" });
  const audioStart = nowMs();
  const assemblies = await Promise.all(
    syllabus.modules.map((module, index) =>
      assembleModule({
        courseId,
        index,
        title: module.title,
        objective: module.objective,
        content: moduleContents[index]!,
        voicePersona,
      }),
    ),
  );
  timings.audioMs = nowMs() - audioStart;
  const blockCount = assemblies.reduce((n, a) => n + a.blocks.length, 0);
  emit({
    type: "stage",
    stage: "audio",
    status: "done",
    detail: `${blockCount} content blocks · narration reserved (stub provider)`,
  });
  throwIfAborted();

  // ── 5. Persist atomically ────────────────────────────────────────────────
  emit({ type: "stage", stage: "persist", status: "running" });
  const persistStart = nowMs();
  const meta = {
    modelsUsed,
    timings: { ...timings, totalMs: nowMs() - startedAt },
    voicePersona,
    ttsProvider: "stub",
    blockCount,
    pipelineVersion: 1,
  };
  await persistCourse({ db, courseId, syllabus, facts, assemblies, meta });
  timings.persistMs = nowMs() - persistStart;
  emit({ type: "stage", stage: "persist", status: "done", detail: "Saved to D1" });

  return { courseId, title: syllabus.title, moduleCount: total };
}
