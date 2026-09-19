export type SyllabusModule = {
  id: string;
  title: string;
  summary: string;
  localContext?: string;
  estimatedMinutes: number;
  lessons: Array<{
    id: string;
    title: string;
    objective: string;
  }>;
};

export type SyllabusOutline = {
  title: string;
  locale: string;
  audience: string;
  learningGoals: string[];
  modules: SyllabusModule[];
  rawBrainDump?: string;
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
