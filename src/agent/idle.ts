export interface IdleActivity {
  message: string;
  category: "encouragement" | "tip" | "observation" | "question";
}

const ENCOURAGEMENTS: string[] = [
  "You're making good progress today.",
  "Small improvements add up over time.",
  "Take a breather if you need one — I'll be here.",
  "Every refactor makes the next one easier.",
  "You're building something solid.",
  "Ship it, then iterate. That's the way.",
  "The best code is the code you don't write.",
  "Nice work so far.",
];

const TIPS: string[] = [
  "Heads up — I can run multiple things in parallel. Just ask me to check a few files at once.",
  "If you want shorter responses, try `/config verbosity minimal`.",
  "Ask me to review your changes before committing — I'll catch things.",
  "I remember past conversations — `/history` to browse them.",
  "I can read several files at once. Just list the paths.",
  "Use `/tasks` to see what we've talked about doing.",
  "Want me to be more proactive? Try `/config proactivity active`.",
  "I know your project structure — `/context` shows what I've picked up.",
  "Try asking me to explain a file you haven't looked at in a while.",
];

const OBSERVATIONS: string[] = [
  "Good structure makes everything easier to maintain.",
  "Tests catch bugs before they reach production.",
  "TypeScript saves you from a lot of headaches.",
  "Good commit messages are a gift to future you.",
  "Documentation is never a waste of time.",
  "Refactoring now saves debugging later.",
  "Clean code is easier to change — and you'll be changing it.",
];

const QUESTIONS: string[] = [
  "Anything I can help with?",
  "Want me to review your changes?",
  "Any tests you'd like me to run?",
  "Should we check on the git status?",
  "Got something you want me to look at?",
  "Want me to explain anything in the codebase?",
  "Need a hand with anything?",
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
  // Random interval between 60-120 seconds (longer to be less intrusive)
  return 60_000 + Math.floor(Math.random() * 60_000);
}
