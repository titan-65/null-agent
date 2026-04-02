import { createElement as h } from "react";
import { Text } from "ink";

export type NullMood = "idle" | "thinking" | "executing" | "happy" | "waiting" | "sleeping";

interface NullFaceProps {
  mood: NullMood;
  frame: number;
}

// Null's face — a simple ASCII character with expressions
const FACES: Record<NullMood, string[]> = {
  idle: [" ◡ ", " ◠ ", " ◡ ", " ◠ ", " ◡ ", " ≡ ", " ◡ ", " ◠ "],
  thinking: [" ◡?", " ◠?", " ◡~", " ◠~", " ◡?", " ≡~", " ◡?", " ◠?"],
  executing: [" ◡⟳", " ◠⟳", " ◡⟳", " ◠⟳", " ◡⟳", " ≡⟳", " ◡⟳", " ◠⟳"],
  happy: [" ◠◠", " ◡◡", " ◠◠", " ◡◡", " ♥ ", " ◠◠", " ◡◡", " ♥ "],
  waiting: [" ◡.", " ◡..", " ◡...", " ◠...", " ◠..", " ◠.", " ◡.", " ◡.."],
  sleeping: [" ◡z", " ◡Z", " ◡zZ", " ≡z", " ◡Z", " ◡z", " ≡Z", " ◡zZ"],
};

const MOOD_COLORS: Record<NullMood, string> = {
  idle: "blue",
  thinking: "yellow",
  executing: "magenta",
  happy: "green",
  waiting: "gray",
  sleeping: "gray",
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
