import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import type {
  SessionStats,
  Goal,
  CalendarEvent,
  ActivitySummary,
} from "../../accountability/types.ts";

interface DailySummaryProps {
  stats: SessionStats | null;
  goals?: Goal[];
  calendarEvents?: CalendarEvent[];
  yesterdaySummary?: ActivitySummary | null;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatEventTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEventDuration(start: Date, end: Date): string {
  const seconds = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return formatDuration(seconds);
}

export const DailySummary = memo(function DailySummary({
  stats,
  goals,
  calendarEvents,
  yesterdaySummary,
  onClose: _onClose,
}: DailySummaryProps) {
  if (!stats && !goals?.length && !calendarEvents?.length) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";

  const hasCalendar = calendarEvents && calendarEvents.length > 0;
  const hasGoals = goals && goals.length > 0;
  const hasYesterday =
    yesterdaySummary &&
    (yesterdaySummary.totalCoding > 0 ||
      yesterdaySummary.totalMeetings > 0 ||
      yesterdaySummary.totalDebugging > 0);

  return h(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
      marginBottom: 1,
    },
    h(Text, { bold: true, color: "cyan" }, `${greeting} Here's your day:`),
    h(Text, null, ""),

    // --- Calendar events ---
    hasCalendar
      ? h(
          Box,
          { flexDirection: "column" },
          h(Text, { bold: true }, "Meetings:"),
          ...calendarEvents!.map((event) =>
            h(
              Box,
              { key: event.id, gap: 1, paddingLeft: 2 },
              h(Text, { color: "gray" }, "·"),
              h(
                Text,
                null,
                `${formatEventTime(event.startTime)}: ${event.title} (${formatEventDuration(event.startTime, event.endTime)})`,
              ),
            ),
          ),
          h(Text, null, ""),
        )
      : null,

    // --- Goals ---
    hasGoals
      ? h(
          Box,
          { flexDirection: "column" },
          h(Text, { bold: true }, "Goals:"),
          ...goals!.map((goal) => {
            const icon =
              goal.status === "completed" ? "✓" : goal.status === "in-progress" ? "⟳" : "·";
            const color =
              goal.status === "completed"
                ? "green"
                : goal.status === "in-progress"
                  ? "yellow"
                  : "gray";
            return h(
              Box,
              { key: goal.id, gap: 1, paddingLeft: 2 },
              h(Text, { color }, icon),
              h(Text, null, goal.description),
            );
          }),
          h(Text, null, ""),
        )
      : null,

    // --- Yesterday's summary ---
    hasYesterday
      ? h(
          Box,
          { flexDirection: "column" },
          h(Text, { bold: true }, "Yesterday:"),
          h(
            Box,
            { paddingLeft: 2 },
            h(
              Text,
              { color: "gray" },
              [
                yesterdaySummary!.totalCoding > 0
                  ? `${formatDuration(yesterdaySummary!.totalCoding)} coding`
                  : null,
                yesterdaySummary!.totalMeetings > 0
                  ? `${formatDuration(yesterdaySummary!.totalMeetings)} meetings`
                  : null,
                yesterdaySummary!.totalDebugging > 0
                  ? `${formatDuration(yesterdaySummary!.totalDebugging)} debugging`
                  : null,
                yesterdaySummary!.totalReviews > 0
                  ? `${formatDuration(yesterdaySummary!.totalReviews)} reviews`
                  : null,
              ]
                .filter(Boolean)
                .join(", "),
            ),
          ),
          h(Text, null, ""),
        )
      : null,

    // --- Current session stats (if no calendar/goals to show) ---
    !hasCalendar && !hasGoals && stats
      ? h(
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
        )
      : null,

    h(Text, { dimColor: true }, "Ctrl+S to dismiss · /report for full report"),
  );
});
