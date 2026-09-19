/**
 * Realistic sample courses. They appear on the landing page as inspiration and
 * on the dashboard as "try one of these" cards until the learner has their own.
 */

export type SampleCourse = {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  audience: string;
  modules: string[];
  minutes: number;
  /** Fake completion so the cards feel alive. */
  progress: number;
  tone: "violet" | "coral" | "ocean" | "mint" | "sun";
  brainDump: string;
};

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    id: "sample-tmu-survival",
    emoji: "🎓",
    title: "TMU Computer Engineering Survival Guide",
    tagline: "Labs, co-op, D2L and the unwritten rules of Kerr Hall.",
    audience: "First year engineering students at Toronto Metropolitan University",
    modules: [
      "Your first two weeks on campus",
      "Labs, D2L and how grading really works",
      "Co-op timelines and resumes that get read",
      "Money, OSAP and student discounts",
      "Staying sane during midterms",
    ],
    minutes: 95,
    progress: 0.6,
    tone: "violet",
    brainDump:
      "I am a first year computer engineering student at TMU in Toronto. I need to understand how labs and D2L work, when co-op applications happen, how OSAP and tuition payments work, and how to survive midterms without burning out.",
  },
  {
    id: "sample-presto-transit",
    emoji: "🚇",
    title: "Mastering PRESTO & Toronto Transit",
    tagline: "Fares, transfers, night buses and never missing the 5:35 again.",
    audience: "Newcomers and students commuting across Toronto",
    modules: [
      "PRESTO in ten minutes",
      "Subway, streetcar and bus basics",
      "Two hour transfers and fare capping",
      "Early shifts and late nights",
      "GO Transit and getting out of the city",
    ],
    minutes: 60,
    progress: 0.25,
    tone: "ocean",
    brainDump:
      "I am new to Toronto and commuting by TTC for early morning shifts and evening classes. I need to understand PRESTO, fares, transfers, night service and how GO Transit connects to the TTC.",
  },
  {
    id: "sample-hospitality-shift",
    emoji: "🍽️",
    title: "Hospitality Shift Management",
    tagline: "Run a smooth floor, handle tips fairly and know your rights.",
    audience: "New servers and shift leads in Ontario restaurants",
    modules: [
      "Opening, closing and everything between",
      "Tips, tip pools and Ontario rules",
      "Handling a slammed Friday",
      "Breaks, wages and your rights",
      "Leading a team when you are new",
    ],
    minutes: 80,
    progress: 0.9,
    tone: "coral",
    brainDump:
      "I just became a shift lead at a downtown Toronto restaurant. I need to understand opening and closing procedures, how tip pools work under Ontario law, breaks and minimum wage rules, and how to manage a busy floor.",
  },
  {
    id: "sample-g2-prep",
    emoji: "🚗",
    title: "Pass Your Ontario G2 Road Test",
    tagline: "What examiners actually watch for, and the mistakes that fail people.",
    audience: "Ontario G1 drivers booking their G2 test",
    modules: [
      "Booking and what to bring",
      "The pre-drive check",
      "Parking, three point turns and lane changes",
      "Test day mindset",
    ],
    minutes: 45,
    progress: 0.4,
    tone: "sun",
    brainDump:
      "My Ontario G2 road test is in two weeks at the Downsview DriveTest centre. I need to know how to book, what to bring, what the examiner checks, and the most common automatic fails.",
  },
  {
    id: "sample-first-lease",
    emoji: "🏠",
    title: "Your First Toronto Lease",
    tagline: "Deposits, the standard lease and how to spot a bad landlord.",
    audience: "Students and young renters signing their first lease in Ontario",
    modules: [
      "How much can a landlord actually ask for",
      "Reading the Ontario standard lease",
      "Move in day checklist",
      "When things go wrong",
    ],
    minutes: 50,
    progress: 0.1,
    tone: "mint",
    brainDump:
      "I am renting my first apartment in Toronto as a student. I need to understand deposits, the Ontario standard lease, what landlords can and cannot ask, and what to do if something breaks.",
  },
];
