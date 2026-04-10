import { createElement as h } from "react";
import { Text, Box } from "ink";

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
  isBlinking?: boolean;
}

interface MoodConfig {
  eyes: string[];
  mouth: string[];
  body: string[];
  color: string;
}

const FACES: Record<NullMood, MoodConfig> = {
  idle: {
    eyes: ["◠◠", "◡◡", "◠◠", "◡◡", "◠◠", "◡◡", "◠◠", "◡◡"],
    mouth: ["◡", "◠", "◡", "◠", "◡", "◠", "◡", "◠"],
    body: ["  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ "],
    color: "blue",
  },
  thinking: {
    eyes: ["◠?", "◠?", "◡?", "◡?", "◠?", "◠?", "◡?", "◡?"],
    mouth: ["~", "~", "◡", "◡", "~", "~", "◡", "◡"],
    body: ["  ╯ ", "  ╯ ", "  ─ ", "  ─ ", "  ╮ ", "  ╮ ", "  ─ ", "  ─ "],
    color: "yellow",
  },
  executing: {
    eyes: ["◠◠", "◠◠", "◡◡", "◡◡", "◠◠", "◠◠", "◡◡", "◡◡"],
    mouth: ["⟳", "⟳", "⟳", "⟳", "⟳", "⟳", "⟳", "⟳"],
    body: ["  │ ", "  ╎ ", "  │ ", "  ╎ ", "  │ ", "  ╎ ", "  │ ", "  ╎ "],
    color: "magenta",
  },
  happy: {
    eyes: ["◡◡", "◡◡", "◠◠", "◠◠", "◡◡", "◡◡", "◠◠", "◠◠"],
    mouth: ["♥", "♥", "◡", "◡", "♥", "♥", "◡", "◡"],
    body: ["  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ "],
    color: "green",
  },
  waiting: {
    eyes: ["◠◠", "◠◠", "◠◠", "◠◠", "◡◡", "◡◡", "◡◡", "◡◡"],
    mouth: [". ", "..", "...", "...", "..", ". ", "..", "..."],
    body: ["  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ ", "  ╷ "],
    color: "gray",
  },
  sleeping: {
    eyes: ["-.-", "-.-", "-.-", "-.-", "-.-", "-.-", "-.-", "-.-"],
    mouth: ["z", "Z", "zz", "zz", "Z", "z", "zz", "zz"],
    body: ["  ∪ ", "  ∪ ", "  ∪ ", "  ∪ ", "  ∪ ", "  ∪ ", "  ∪ ", "  ∪ "],
    color: "gray",
  },
  excited: {
    eyes: ["★★", "★★", "✧✧", "✧✧", "★★", "★★", "✦✦", "✦✦"],
    mouth: ["✧", "✧", "◡", "◡", "✧", "✧", "◡", "◡"],
    body: ["  ╱ ", "  ╱ ", "  ╱ ", "  ╱ ", "  ╲ ", "  ╲ ", "  ╲ ", "  ╲ "],
    color: "cyan",
  },
  confused: {
    eyes: ["◠?", "◠?", "◡?", "◡?", "◠?", "◠?", "◡?", "◡?"],
    mouth: ["/", "\\", "/", "\\", "/", "\\", "/", "\\"],
    body: ["  ╮ ", "  ╭ ", "  ╮ ", "  ╭ ", "  ╮ ", "  ╭ ", "  ╮ ", "  ╭ "],
    color: "yellow",
  },
  error: {
    eyes: ["✕✕", "✕✕", "××", "××", "✕✕", "✕✕", "××", "××"],
    mouth: ["×", "×", "×", "×", "×", "×", "×", "×"],
    body: ["  ╎ ", "  ╎ ", "  ╎ ", "  ╎ ", "  ╎ ", "  ╎ ", "  ╎ ", "  ╎ "],
    color: "red",
  },
  success: {
    eyes: ["◡◡", "◡◡", "◠◠", "◠◠", "◡◡", "◡◡", "◠◠", "◠◠"],
    mouth: ["✓", "✓", "◡", "◡", "✓", "✓", "◡", "◡"],
    body: ["  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ ", "  ╹ "],
    color: "green",
  },
  loading: {
    eyes: ["◠◠", "◠◠", "◠◠", "◠◠", "◡◡", "◡◡", "◡◡", "◡◡"],
    mouth: ["|", "/", "-", "\\", "|", "/", "-", "\\"],
    body: ["  │ ", "  ╎ ", "  ─ ", "  ╎ ", "  │ ", "  ╎ ", "  ─ ", "  ╎ "],
    color: "blue",
  },
};

const BLINK_EYES = {
  idle: "-.-",
  thinking: "-.-",
  executing: "-.-",
  happy: "-.-",
  waiting: "-.-",
  sleeping: "-.-",
  excited: "-.-",
  confused: "-.-",
  error: "-.-",
  success: "-.-",
  loading: "-.-",
};

export function NullFace({ mood, frame, isBlinking = false }: NullFaceProps) {
  const config = FACES[mood];
  const frameIndex = frame % config.eyes.length;
  const eyes = isBlinking ? BLINK_EYES[mood] : config.eyes[frameIndex];
  const mouth = config.mouth[frameIndex];
  const body = config.body[frameIndex];

  return h(
    Box,
    { flexDirection: "column" },
    h(Text, { color: config.color, bold: true }, "  ╭───╮"),
    h(
      Box,
      { flexDirection: "row" },
      h(Text, { color: config.color, bold: true }, "  │"),
      h(Text, { color: config.color, bold: true }, eyes),
      h(Text, { color: config.color, bold: true }, "│"),
    ),
    h(
      Box,
      { flexDirection: "row" },
      h(Text, { color: config.color, bold: true }, "╰─┬─╯"),
      h(Text, { color: config.color, bold: true }, mouth),
      h(Text, { color: config.color }, "  "),
      h(Text, { color: config.color, dimColor: true }, body),
    ),
  );
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
