import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import { NullFace, type NullMood } from "./NullFace.tsx";

interface AgentBarProps {
  mood: NullMood;
  frame: number;
  status: string;
  openTaskCount: number;
  isBlinking?: boolean;
}

export const AgentBar = memo(function AgentBar({
  mood,
  frame,
  status,
  openTaskCount,
  isBlinking = false,
}: AgentBarProps) {
  return h(
    Box,
    {
      paddingX: 1,
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    h(
      Box,
      { gap: 1, flexDirection: "column" },
      h(NullFace, { mood, frame, isBlinking }),
      h(Text, { color: getMoodColor(mood) }, status),
      openTaskCount > 0 ? h(Text, { color: "yellow" }, `${openTaskCount} task(s)`) : null,
    ),
    h(Box, { gap: 1 }, h(Text, { color: "gray" }, "/help")),
  );
});

function getMoodColor(mood: NullMood): string {
  switch (mood) {
    case "thinking":
      return "yellow";
    case "executing":
      return "magenta";
    case "happy":
      return "green";
    case "waiting":
      return "gray";
    case "sleeping":
      return "gray";
    default:
      return "blue";
  }
}
