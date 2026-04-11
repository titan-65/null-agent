import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import type { ProjectContext } from "../context.ts";
import { VERSION } from "../../version.ts";
import type { Activity } from "../../accountability/types.ts";

interface StatusBarProps {
  provider: string;
  model: string;
  toolCount: number;
  project?: ProjectContext;
  status: "idle" | "thinking" | "executing" | "waiting";
  currentActivity?: Activity | null;
}

const MAX_PROJECT_NAME = 20;
const MAX_MODEL_NAME = 15;

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function formatActivityDuration(activity: Activity | null): string {
  if (!activity) return "";
  const seconds = Math.floor((Date.now() - activity.startTime.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getActivityIcon(type: string): string {
  switch (type) {
    case "coding":
      return "⌨";
    case "review":
      return "👁";
    case "debugging":
      return "🔍";
    case "testing":
      return "✓";
    case "meeting":
      return "📅";
    case "docs":
      return "📝";
    default:
      return "•";
  }
}

export const StatusBar = memo(function StatusBar({
  provider,
  model,
  toolCount,
  project,
  status,
  currentActivity,
}: StatusBarProps) {
  const statusInfo = getStatusInfo(status);

  return h(
    Box,
    {
      borderStyle: "round",
      borderColor: "blue",
      paddingX: 1,
      justifyContent: "space-between",
    },
    h(
      Box,
      { gap: 2 },
      h(Text, { bold: true, color: "blue" }, "null-agent"),
      h(Text, { color: "gray" }, `v${VERSION}`),
      project
        ? h(
            Box,
            { gap: 1 },
            h(Text, { color: "gray" }, "·"),
            h(Text, { color: "cyan" }, truncate(project.projectName, MAX_PROJECT_NAME)),
            project.gitBranch
              ? h(Text, { color: "yellow" }, `(${truncate(project.gitBranch, 15)})`)
              : null,
            project.hasChanges ? h(Text, { color: "red" }, "●") : h(Text, { color: "green" }, "●"),
          )
        : null,
    ),
    h(
      Box,
      { gap: 2 },
      currentActivity
        ? h(
            Box,
            { gap: 1 },
            h(Text, { color: "magenta" }, getActivityIcon(currentActivity.type)),
            h(Text, { color: "gray" }, truncate(currentActivity.type, 10)),
            h(Text, { color: "gray" }, formatActivityDuration(currentActivity)),
          )
        : null,
      h(Text, { color: "gray" }, truncate(provider, 10)),
      h(Text, { color: "gray" }, truncate(model, MAX_MODEL_NAME)),
      h(Text, { color: "gray" }, `${toolCount} tools`),
      h(Text, { color: statusInfo.color }, statusInfo.label),
    ),
  );
});

function getStatusInfo(status: StatusBarProps["status"]): {
  label: string;
  color: string;
} {
  switch (status) {
    case "thinking":
      return { label: "thinking...", color: "yellow" };
    case "executing":
      return { label: "executing...", color: "magenta" };
    case "waiting":
      return { label: "waiting", color: "gray" };
    default:
      return { label: "ready", color: "green" };
  }
}
