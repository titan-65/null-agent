import { createElement as h } from "react";
import { Box, Text } from "ink";

interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

interface ToolCallProps {
  toolCall: ToolCallData;
}

export function ToolCall({ toolCall }: ToolCallProps) {
  const isComplete = toolCall.result !== undefined;
  const statusColor = toolCall.isError ? "red" : "green";
  const statusIcon = toolCall.isError ? "✗" : "✓";
  const description = getToolDescription(toolCall);

  return h(
    Box,
    {
      flexDirection: "column",
      marginLeft: 1,
      borderStyle: "single",
      borderColor: isComplete ? statusColor : "yellow",
      paddingX: 1,
      marginBottom: 1,
    },
    // Tool call header
    h(
      Box,
      { gap: 1 },
      h(Text, { color: "yellow" }, "⚙"),
      h(Text, { bold: true, color: "yellow" }, toolCall.name),
      h(Text, { color: "gray" }, description),
    ),
    // Result (if available)
    isComplete
      ? h(
          Box,
          { gap: 1, flexDirection: "column" },
          h(
            Box,
            { gap: 1 },
            h(Text, { color: statusColor }, statusIcon),
            h(Text, { color: statusColor }, formatResult(toolCall.name, toolCall.result!)),
          ),
        )
      : h(
          Box,
          { gap: 1 },
          h(Text, { color: "yellow" }, "⠋"),
          h(Text, { color: "gray", italic: true }, "executing..."),
        ),
  );
}

function getToolDescription(toolCall: ToolCallData): string {
  const args = toolCall.arguments;

  switch (toolCall.name) {
    case "file_read":
      return String(args["path"] ?? "");
    case "file_write":
      return String(args["path"] ?? "");
    case "shell":
      return String(args["command"] ?? "");
    case "git_status":
      return "";
    case "git_diff": {
      const parts: string[] = [];
      if (args["staged"]) parts.push("--staged");
      if (args["path"]) parts.push(String(args["path"]));
      return parts.join(" ");
    }
    case "git_log":
      return `last ${args["count"] ?? 10} commits`;
    case "git_branch":
      return args["all"] ? "all branches" : "local branches";
    case "git_add":
      return String(args["path"] ?? "");
    case "git_commit":
      return `"${String(args["message"] ?? "").slice(0, 40)}"`;
    case "git_show":
      return String(args["ref"] ?? "HEAD");
    default:
      return "";
  }
}

function formatResult(toolName: string, result: string): string {
  const firstLine = result.split("\n")[0] ?? "";

  switch (toolName) {
    case "file_read": {
      const lineCount = result.split("\n").length;
      return `${lineCount} lines`;
    }
    case "file_write":
      return firstLine;
    case "shell":
      return truncate(firstLine, 70);
    case "git_status":
    case "git_diff":
    case "git_log":
    case "git_branch": {
      const lineCount = result.split("\n").length;
      return `${lineCount} lines`;
    }
    case "git_add":
      return "staged";
    case "git_commit":
      return truncate(firstLine, 60);
    default:
      return truncate(firstLine, 70);
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}
