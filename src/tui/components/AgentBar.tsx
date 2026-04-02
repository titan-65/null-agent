import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import { NullFace, type NullMood } from "./NullFace.tsx";

interface AgentBarProps {
  mood: NullMood;
  frame: number;
  status: string;
  openTaskCount: number;
}

export const AgentBar = memo(function AgentBar({
  mood,
  frame,
  status,
  openTaskCount,
}: AgentBarProps) {
  return h(
    Box,
    {
      paddingX: 1,
      justifyContent: "space-between",
    },
    h(
      Box,
      { gap: 1 },
      h(NullFace, { mood, frame }),
      h(Text, { color: getMoodColor(mood) }, status),
      openTaskCount > 0 ? h(Text, { color: "yellow" }, `· ${openTaskCount} task(s)`) : null,
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
