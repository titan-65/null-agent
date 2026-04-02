export interface IdleActivity {
  message: string;
  category: "encouragement" | "tip" | "observation" | "question";
}

const ENCOURAGEMENTS: string[] = [
  "You're making great progress today.",
  "Clean code is happy code.",
  "Small improvements compound over time.",
  "Take a break if you need one.",
  "Every refactor makes the next one easier.",
  "You're building something cool.",
  "Consistency beats intensity.",
  "Good code tells a story.",
  "Ship it, then improve it.",
  "The best code is the code you don't write.",
];

const TIPS: string[] = [
  "Tip: Run `git diff --staged` before committing to review your changes.",
  "Tip: Use `/tasks` to see what's been tracked in our conversation.",
  "Tip: I can run multiple tools in parallel — just ask me to investigate several things at once.",
  "Tip: Use `/config verbosity minimal` for shorter responses.",
  "Tip: Type `/context` to see what I know about this project.",
  "Tip: Ask me to 'review my changes' for a quick code review.",
  "Tip: I remember our conversations — use `/history` to browse past sessions.",
  "Tip: Try '/config proactivity active' to get more suggestions from me.",
  "Tip: I can read multiple files at once — just list the paths.",
  "Tip: Use `/tasks` to see open action items from our conversation.",
];

const OBSERVATIONS: string[] = [
  "The codebase is looking cleaner.",
  "Good structure makes everything easier.",
  "Tests are your safety net.",
  "TypeScript catches bugs before they happen.",
  "Monorepos reward good organization.",
  "Good commit messages help future you.",
  "Documentation is never wasted effort.",
  "Refactoring is an investment, not a cost.",
];

const QUESTIONS: string[] = [
  "Need help with anything?",
  "Want me to review anything?",
  "Any tests you want me to run?",
  "Should we check git status?",
  "Anything to commit?",
];

const ALL_POOLS = [
  { pool: ENCOURAGEMENTS, category: "encouragement" as const },
  { pool: TIPS, category: "tip" as const },
  { pool: OBSERVATIONS, category: "observation" as const },
  { pool: QUESTIONS, category: "question" as const },
];

let lastCategory = "";
let lastMessage = "";

export function getIdleActivity(): IdleActivity {
  // Weighted selection: tips and questions more likely
  const weights = [0.2, 0.35, 0.15, 0.3];
  const roll = Math.random();
  let cumulative = 0;
  let selectedIndex = 0;

  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!;
    if (roll < cumulative) {
      selectedIndex = i;
      break;
    }
  }

  const selected = ALL_POOLS[selectedIndex]!;
  let message = selected.pool[Math.floor(Math.random() * selected.pool.length)]!;

  // Avoid repeating the same message or category consecutively
  let attempts = 0;
  while ((message === lastMessage || selected.category === lastCategory) && attempts < 10) {
    const alt = ALL_POOLS[Math.floor(Math.random() * ALL_POOLS.length)]!;
    message = alt.pool[Math.floor(Math.random() * alt.pool.length)]!;
    attempts++;
  }

  lastMessage = message;
  lastCategory = selected.category;

  return { message, category: selected.category };
}

export function getIdleIntervalMs(): number {
  // Random interval between 45-90 seconds
  return 45_000 + Math.floor(Math.random() * 45_000);
}
