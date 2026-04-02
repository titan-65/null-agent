import { createElement as h } from "react";
import { Box, Text } from "ink";

interface FormattedTextProps {
  content: string;
}

/**
 * Renders text with basic markdown-like formatting for the terminal.
 * Supports: headers, code blocks, inline code, bold, lists, blockquotes.
 */
export function FormattedText({ content }: FormattedTextProps) {
  const blocks = parseBlocks(content);

  return h(Box, { flexDirection: "column" }, ...blocks.map((block, i) => renderBlock(block, i)));
}

type Block =
  | { type: "text"; content: string }
  | { type: "heading"; level: number; content: string }
  | { type: "code"; lang: string; content: string }
  | { type: "list"; items: string[] }
  | { type: "blockquote"; content: string }
  | { type: "empty" };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Empty line
    if (line.trim() === "") {
      blocks.push({ type: "empty" });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length,
        content: headingMatch[2]!,
      });
      i++;
      continue;
    }

    // List items
    if (line.match(/^[\s]*[-*•]\s+/) || line.match(/^[\s]*\d+\.\s+/)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i]!.match(/^[\s]*[-*•]\s+/) || lines[i]!.match(/^[\s]*\d+\.\s+/))
      ) {
        items.push(lines[i]!.replace(/^[\s]*[-*•]\s+/, "").replace(/^[\s]*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) {
        quoteLines.push(lines[i]!.slice(1).trim());
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Regular text - collect consecutive text lines
    const textLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("```") &&
      !lines[i]!.match(/^#{1,3}\s/) &&
      !lines[i]!.match(/^[\s]*[-*•]\s+/) &&
      !lines[i]!.match(/^[\s]*\d+\.\s+/) &&
      !lines[i]!.startsWith(">")
    ) {
      textLines.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "text", content: textLines.join("\n") });
  }

  return blocks;
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case "empty":
      return h(Text, { key }, " ");

    case "heading": {
      const color = block.level === 1 ? "blue" : block.level === 2 ? "cyan" : "white";
      return h(
        Box,
        { key, marginTop: block.level === 1 ? 0 : 0, marginBottom: 0 },
        h(Text, { bold: true, color }, block.content),
      );
    }

    case "code":
      return h(
        Box,
        {
          key,
          flexDirection: "column",
          borderStyle: "single",
          borderColor: "gray",
          paddingX: 1,
          marginTop: 0,
          marginBottom: 0,
        },
        h(Text, { color: "gray" }, block.lang),
        ...block.content
          .split("\n")
          .map((line, i) => h(Text, { key: i, color: "white" }, `  ${line}`)),
      );

    case "list":
      return h(
        Box,
        { key, flexDirection: "column" },
        ...block.items.map((item, i) =>
          h(
            Box,
            { key: i, gap: 1 },
            h(Text, { color: "blue" }, "•"),
            h(Text, null, formatInline(item)),
          ),
        ),
      );

    case "blockquote":
      return h(
        Box,
        { key, gap: 1 },
        h(Text, { color: "gray" }, "│"),
        h(Text, { color: "gray", italic: true }, block.content),
      );

    case "text":
      return h(Text, { key }, formatInline(block.content));
  }
}

/**
 * Format inline markdown: bold, inline code, links.
 * Returns the formatted string (ink Text doesn't support mixed styles per string,
 * so we apply the dominant style).
 */
function formatInline(text: string): string {
  // Remove bold markers for now (ink limitation)
  let result = text.replace(/\*\*(.+?)\*\*/g, "$1");
  // Remove italic markers
  result = result.replace(/_(.+?)_/g, "$1");
  // Keep inline code visible with backticks
  result = result.replace(/`([^`]+)`/g, "[$1]");
  return result;
}
