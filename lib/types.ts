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
