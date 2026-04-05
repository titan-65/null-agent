import { createElement as h } from "react";
import { Text } from "ink";

export type NullMood =
  | "idle"
  | "thinking"
  | "executing"
  | "happy"
  | "waiting"
  | "sleeping"
  | "excited"
  | "confused"
  | "error"
  | "success"
  | "loading";

interface NullFaceProps {
  mood: NullMood;
  frame: number;
}

// Null's face — animated expressions for different states
const FACES: Record<NullMood, string[]> = {
  // Calm, relaxed — default state
  idle: [
    " ◡ ",
    " ◠ ",
    " ◡ ",
    " ◠ ",
    " ◡ ",
    " ≡ ",
    " ◡ ",
    " ◠ ",
  ],

  // Curious, pondering — processing a request
  thinking: [
    " ◡?",
    " ◠?",
    " ◡~",
    " ◠~",
    " ◡?",
    " ≡~",
    " ◡?",
    " ◠?",
  ],

  // Active, working — running tools
  executing: [
    " ◡⟳",
    " ◠⟳",
    " ◡⟳",
    " ◠⟳",
    " ◡⟳",
    " ≡⟳",
    " ◡⟳",
    " ◠⟳",
  ],

  // Smiling, pleased — good results
  happy: [
    " ◠◠",
    " ◡◡",
    " ◠◠",
    " ◡◡",
    " ♥ ",
    " ◠◠",
    " ◡◡",
    " ♥ ",
  ],

  // Patient, waiting dots — streaming response
  waiting: [
    " ◡.",
    " ◡..",
    " ◡...",
    " ◠...",
    " ◠..",
    " ◠.",
    " ◡.",
    " ◡..",
  ],

  // Dozing off — idle for a while
  sleeping: [
    " ◡z",
    " ◡Z",
    " ◡zZ",
    " ≡z",
    " ◡Z",
    " ◡z",
    " ≡Z",
    " ◡zZ",
  ],

  // Sparkly eyes — something cool happened
  excited: [
    " ★★",
    " ✧✧",
    " ★★",
    " ✦✦",
    " ★★",
    " ✧✧",
    " ★★",
    " ✦✦",
  ],

  // Tilting head, unsure — doesn't understand
  confused: [
    " ◡/",
    " ◠/",
    " ◡\\",
    " ◠\\",
    " ◡?",
    " ◠?",
    " ◡/",
    " ◠/",
  ],

  // X eyes — something broke
  error: [
    " ✕✕",
    " ××",
    " ✕✕",
    " ××",
    " ✕✕",
    " ××",
    " ✕✕",
    " ××",
  ],

  // Check marks — task completed
  success: [
    " ✓✓",
    " ✔✔",
    " ✓✓",
    " ✔✔",
    " ♥ ",
    " ✓✓",
    " ✔✔",
    " ♥ ",
  ],

  // Spinning — loading state
  loading: [
    " ◡|",
    " ◡/",
    " ◡-",
    " ◡\\",
    " ◠|",
    " ◠/",
    " ◠-",
    " ◠\\",
  ],
};

const MOOD_COLORS: Record<NullMood, string> = {
  idle: "blue",
  thinking: "yellow",
  executing: "magenta",
  happy: "green",
  waiting: "gray",
  sleeping: "gray",
  excited: "cyan",
  confused: "yellow",
  error: "red",
  success: "green",
  loading: "blue",
};

export function NullFace({ mood, frame }: NullFaceProps) {
  const faces = FACES[mood];
  const face = faces[frame % faces.length]!;
  const color = MOOD_COLORS[mood];

  return h(Text, { color, bold: true }, `◉${face}`);
}

export function getMoodForStatus(
  status: "idle" | "thinking" | "executing" | "waiting",
  hasRecentActivity: boolean,
): NullMood {
  switch (status) {
    case "thinking":
      return "thinking";
    case "executing":
      return "executing";
    case "waiting":
      return "waiting";
    default:
      return hasRecentActivity ? "happy" : "idle";
  }
}
