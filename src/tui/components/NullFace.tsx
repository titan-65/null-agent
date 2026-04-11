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

const FACES: Record<NullMood, string[]> = {
  idle: [" ◡ ", " ◠ ", " ◡ ", " ◠ ", " ◡ ", " ≡ ", " ◡ ", " ◠ "],
  thinking: [" ◡?", " ◠?", " ◡~", " ◠~", " ◡?", " ≡~", " ◡?", " ◠?"],
  executing: [" ◡⟳", " ◠⟳", " ◡⟳", " ◠⟳", " ◡⟳", " ≡⟳", " ◡⟳", " ◠⟳"],
  happy: [" ◠◠", " ◡◡", " ◠◠", " ◡◡", " ♥ ", " ◠◠", " ◡◡", " ♥ "],
  waiting: [" ◡.", " ◡..", " ◡...", " ◠...", " ◠..", " ◠.", " ◡.", " ◡.."],
  sleeping: [" ◡z", " ◡Z", " ◡zZ", " ≡z", " ◡Z", " ◡z", " ≡Z", " ◡zZ"],
  excited: [" ★★", " ✧✧", " ★★", " ✦✦", " ★★", " ✧✧", " ★★", " ✦✦"],
  confused: [" ◡/", " ◠/", " ◡\\", " ◠\\", " ◡?", " ◠?", " ◡/", " ◠/"],
  error: [" ✕✕", " ××", " ✕✕", " ××", " ✕✕", " ××", " ✕✕", " ××"],
  success: [" ✓✓", " ✔✔", " ✓✓", " ✔✔", " ♥ ", " ✓✓", " ✔✔", " ♥ "],
  loading: [" ◡|", " ◡/", " ◡-", " ◡\\", " ◠|", " ◠/", " ◠-", " ◠\\"],
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

/**
 * Returns a face mood based on the current tracked activity type.
 * Used when the agent is idle (not actively processing a request).
 */
export function getMoodForActivity(activityType: string | null | undefined): NullMood {
  switch (activityType) {
    case "coding":
      return "executing";
    case "review":
      return "thinking";
    case "debugging":
      return "confused";
    case "testing":
      return "loading";
    case "meeting":
    case "standup":
      return "waiting";
    case "docs":
    case "planning":
      return "thinking";
    case "break":
      return "sleeping";
    default:
      return "idle";
  }
}
