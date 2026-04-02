import { createElement as h, memo } from "react";
import { Box, Text } from "ink";
import type { TuiMessage } from "../app.tsx";
import { ToolCall } from "./ToolCall.tsx";
import { FormattedText } from "./FormattedText.tsx";

interface ChatPanelProps {
  messages: TuiMessage[];
}

export function ChatPanel({ messages }: ChatPanelProps) {
  if (messages.length === 0) {
    return h(
      Box,
      {
        flexGrow: 1,
        flexDirection: "column",
        paddingX: 2,
        paddingY: 1,
        justifyContent: "center",
        alignItems: "center",
      },
      h(
        Box,
        { flexDirection: "column", alignItems: "center", gap: 1 },
        h(Text, { bold: true, color: "blue" }, "null-agent"),
        h(Text, { color: "gray" }, "Your coding assistant"),
        h(Text, null, ""),
        h(Text, { color: "gray" }, "Try: 'review my changes' or 'explain src/index.ts'"),
        h(Text, { color: "gray" }, "Type /help for keyboard shortcuts"),
      ),
    );
  }

  return h(
    Box,
    { flexGrow: 1, flexDirection: "column", paddingX: 1, paddingY: 1 },
    ...messages.map((msg, i) =>
      h(MessageBubble, {
        key: i,
        message: msg,
        isLast: i === messages.length - 1,
        index: i,
      }),
    ),
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  isLast,
}: {
  message: TuiMessage;
  isLast: boolean;
  index: number;
}) {
  switch (message.role) {
    case "system":
      return h(
        Box,
        {
          flexDirection: "column",
          marginBottom: 1,
          paddingX: 1,
          borderStyle: "round",
          borderColor: "gray",
        },
        h(Text, { color: "gray", italic: true }, message.content),
      );

    case "user":
      return h(
        Box,
        { flexDirection: "column", marginBottom: 1 },
        h(Box, { gap: 1 }, h(Text, { bold: true, color: "green" }, "▸ you")),
        h(Box, { paddingLeft: 1 }, h(Text, { color: "white" }, message.content)),
      );

    case "assistant":
      return h(
        Box,
        { flexDirection: "column", marginBottom: 1 },
        // Header with spinner only while streaming
        h(
          Box,
          { gap: 1 },
          h(Text, { bold: true, color: "blue" }, "▸ assistant"),
          message.isStreaming ? h(Text, { color: "yellow" }, "⠋") : null,
        ),
        // Tool calls
        message.toolCalls.length > 0
          ? h(
              Box,
              { flexDirection: "column", paddingLeft: 1, marginBottom: 0 },
              ...message.toolCalls.map((tc, i) => h(ToolCall, { key: i, toolCall: tc })),
            )
          : null,
        // Text content — plain while streaming, formatted when done
        message.content.length > 0
          ? message.isStreaming
            ? h(Box, { paddingLeft: 1 }, h(Text, { color: "white" }, message.content))
            : h(
                Box,
                { flexDirection: "column", paddingLeft: 1 },
                h(FormattedText, { content: message.content }),
              )
          : message.isStreaming
            ? h(
                Box,
                { gap: 1, paddingLeft: 1 },
                h(Text, { color: "yellow" }, "⠋"),
                h(Text, { color: "gray", italic: true }, "thinking..."),
              )
            : null,
        // Separator
        !isLast ? h(Box, { marginTop: 0 }, h(Text, { color: "gray" }, "─".repeat(40))) : null,
      );
  }
});
