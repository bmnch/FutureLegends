// ---------------------------------------------------------------------------
// Pre-payment syllabus preview (existing onboarding flow)
// ---------------------------------------------------------------------------

export type SyllabusModule = {
  title: string;
  description: string;
  estimatedMinutes: number;
  topics: string[];
};

export type SyllabusOutline = {
  courseTitle: string;
  modules: SyllabusModule[];
  rawBrainDump?: string;
  /** @deprecated Prefer courseTitle — kept for checkout metadata aliases */
  title?: string;
};

/** @deprecated Legacy placeholder shape kept for the old reader components. */
export type CourseContent = {
  courseId: string;
  title: string;
  sections: Array<{
    id: string;
    heading: string;
    body: string;
  }>;
  narrationUrl?: string;
};

// ---------------------------------------------------------------------------
// Multi-agent pipeline artefacts
// ---------------------------------------------------------------------------

export type FactConfidence = "high" | "medium" | "low";

/** Output of the Research Agent: factual guard-rails for every later agent. */
export type ResearchFacts = {
  locale: {
    city: string | null;
    region: string | null;
    country: string | null;
    confidence: FactConfidence;
  };
  audienceProfile: string;
  constraints: Array<{
    topic: string;
    fact: string;
    whyItMatters: string;
    confidence: FactConfidence;
    verifyWith: string;
  }>;
  openQuestions: string[];
};

/** Output of the Architect Agent: the deeply structured syllabus. */
export type ArchitectModule = {
  title: string;
  objective: string;
  subtopics: string[];
  estimatedMinutes: number;
  localizationHooks: string[];
};

export type ArchitectSyllabus = {
  title: string;
  targetAudience: string;
  summary: string;
  modules: ArchitectModule[];
};

/** Output of the Content Agent for a single module. */
export type QuizOption = {
  id: string;
  text: string;
  correct: boolean;
  /** Immediate, localized feedback shown when this option is picked. */
  feedback: string;
};

export type ContentAgentQuiz = {
  question: string;
  options: QuizOption[];
  explanation: string;
};

export type ContentAgentScenario = {
  title: string;
  setting: string;
  /** Markdown narrative that places the learner in a concrete local situation. */
  narrative: string;
  challenge: string;
  /** Markdown step-by-step model answer. */
  walkthrough: string;
  debrief: string;
};

export type ContentAgentSection = {
  title: string;
  /** Markdown body — headings, lists, callouts, tables allowed. */
  markdown: string;
};

export type ContentAgentModule = {
  sections: ContentAgentSection[];
  scenario: ContentAgentScenario;
  quizzes: ContentAgentQuiz[];
};

// ---------------------------------------------------------------------------
// Content block payloads (stored as JSON in `content_blocks.content`)
// ---------------------------------------------------------------------------

export type TtsProvider = "stub" | "elevenlabs" | "deepgram-aura";

export type TextBlockPayload = {
  kind: "text";
  title: string;
  markdown: string;
  /** Plain-text version used for narration + retrieval. */
  plainText: string;
  narration: NarrationMeta | null;
};

export type AudioBlockPayload = {
  kind: "audio";
  title: string;
  transcript: string;
  narration: NarrationMeta;
};

export type QuizBlockPayload = {
  kind: "quiz";
  question: string;
  options: QuizOption[];
  explanation: string;
  /** Learner must select a correct option before the module unlocks. */
  gate: true;
};

export type ScenarioBlockPayload = {
  kind: "scenario";
} & ContentAgentScenario;

export type NarrationMeta = {
  provider: TtsProvider;
  voicePersona: string;
  estimatedDurationSec: number;
  characterCount: number;
};

export type ContentBlockPayload =
  | TextBlockPayload
  | AudioBlockPayload
  | QuizBlockPayload
  | ScenarioBlockPayload;

// ---------------------------------------------------------------------------
// Hydrated course delivered to the player
// ---------------------------------------------------------------------------

export type PlayerBlock = {
  id: string;
  sequenceOrder: number;
  type: ContentBlockPayload["kind"];
  content: ContentBlockPayload;
  audioUrl: string | null;
};

export type PlayerModule = {
  id: string;
  sequenceOrder: number;
  title: string;
  objective: string;
  blocks: PlayerBlock[];
};

export type PlayerCourse = {
  id: string;
  title: string;
  targetAudience: string;
  status: "generating" | "ready" | "failed";
  generatedAt: string;
  researchFacts: ResearchFacts | null;
  generationMeta: Record<string, unknown> | null;
  modules: PlayerModule[];
};

// ---------------------------------------------------------------------------
// Streaming progress protocol for /api/generate-course (NDJSON)
// ---------------------------------------------------------------------------

export type PipelineStage =
  | "research"
  | "architect"
  | "content"
  | "audio"
  | "persist";

export type GenerationEvent =
  | { type: "accepted"; courseId: string }
  | { type: "stage"; stage: PipelineStage; status: "running" | "done"; detail?: string }
  | { type: "module"; index: number; total: number; title: string; status: "running" | "done" | "retrying" }
  | { type: "log"; message: string }
  | { type: "complete"; courseId: string; title: string; moduleCount: number }
  | { type: "error"; message: string; courseId?: string };

// ---------------------------------------------------------------------------
// Module chat
// ---------------------------------------------------------------------------

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};
