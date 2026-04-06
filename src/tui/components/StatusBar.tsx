import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import type { ProjectContext } from "../context.ts";
import { VERSION } from "../../version.ts";

interface StatusBarProps {
  provider: string;
  model: string;
  toolCount: number;
  project?: ProjectContext;
  status: "idle" | "thinking" | "executing" | "waiting";
}

export const StatusBar = memo(function StatusBar({
  provider,
  model,
  toolCount,
  project,
  status,
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
            h(Text, { color: "cyan" }, project.projectName),
            project.gitBranch ? h(Text, { color: "yellow" }, `(${project.gitBranch})`) : null,
            project.hasChanges ? h(Text, { color: "red" }, "●") : h(Text, { color: "green" }, "●"),
          )
        : null,
    ),
    h(
      Box,
      { gap: 2 },
      h(Text, { color: "gray" }, provider),
      h(Text, { color: "gray" }, model),
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
