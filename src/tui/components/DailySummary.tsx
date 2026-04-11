import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import type { SessionStats } from "../../accountability/types.ts";

interface DailySummaryProps {
  stats: SessionStats | null;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export const DailySummary = memo(function DailySummary({
  stats,
  onClose: _onClose,
}: DailySummaryProps) {
  if (!stats) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";

  return h(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginBottom: 1,
    },
    h(Text, { bold: true, color: "cyan" }, greeting),
    h(Text, null, ""),
    h(
      Box,
      { flexDirection: "column" },
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Session:"),
        h(Text, null, formatDuration(stats.sessionDuration)),
      ),
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Activities:"),
        h(Text, null, `${stats.activitiesToday}`),
      ),
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Coding:"),
        h(Text, null, formatDuration(stats.timeByType["coding"] || 0)),
      ),
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Meetings:"),
        h(Text, null, formatDuration(stats.timeByType["meeting"] || 0)),
      ),
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Reviews:"),
        h(Text, null, formatDuration(stats.timeByType["review"] || 0)),
      ),
      h(
        Box,
        { gap: 1 },
        h(Text, { bold: true }, "Debugging:"),
        h(Text, null, formatDuration(stats.timeByType["debugging"] || 0)),
      ),
    ),
    h(Text, { dimColor: true }, "Press Ctrl+S to see full report"),
  );
});
