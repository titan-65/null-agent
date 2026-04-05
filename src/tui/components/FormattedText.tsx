import { createElement as h } from "react";
import { Box, Text } from "ink";

interface FormattedTextProps {
  content: string;
}

/**
 * Renders text with basic markdown-like formatting for the terminal.
 * Supports: headers, code blocks, inline code, bold, lists, blockquotes, diffs.
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
  | { type: "diff"; content: string }
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

    // Diff block (starts with +/-/@)
    if (
      line.match(/^[+-@]/) &&
      (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@"))
    ) {
      const diffLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i]!.startsWith("+") ||
          lines[i]!.startsWith("-") ||
          lines[i]!.startsWith("@@") ||
          lines[i]!.startsWith(" "))
      ) {
        diffLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "diff", content: diffLines.join("\n") });
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

    // Regular text
    const textLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.startsWith("```") &&
      !lines[i]!.match(/^#{1,3}\s/) &&
      !lines[i]!.match(/^[\s]*[-*•]\s+/) &&
      !lines[i]!.match(/^[\s]*\d+\.\s+/) &&
      !lines[i]!.startsWith(">") &&
      !lines[i]!.match(/^[+-@]/)
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
      return h(Box, { key }, h(Text, { bold: true, color }, block.content));
    }

    case "code":
      return h(
        Box,
        {
          key,
          flexDirection: "column",
          borderStyle: "round",
          borderColor: "gray",
          paddingX: 1,
        },
        h(Text, { color: "gray" }, block.lang),
        ...highlightCode(block.content, block.lang),
      );

    case "diff":
      return h(
        Box,
        {
          key,
          flexDirection: "column",
          borderStyle: "round",
          borderColor: "gray",
          paddingX: 1,
        },
        ...block.content.split("\n").map((line, i) => {
          const color = line.startsWith("+")
            ? "green"
            : line.startsWith("-")
              ? "red"
              : line.startsWith("@@")
                ? "cyan"
                : "white";
          return h(Text, { key: i, color }, line);
        }),
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
 * Basic syntax highlighting for terminal code blocks.
 */
function highlightCode(code: string, lang: string) {
  const lines = code.split("\n");

  return lines.map((line, i) => {
    const colored = colorizeLine(line, lang);
    return h(Text, { key: i }, colored);
  });
}

function colorizeLine(line: string, lang: string): string {
  // ANSI color codes
  const CYAN = "\x1b[36m";
  const YELLOW = "\x1b[33m";
  const GREEN = "\x1b[32m";
  const MAGENTA = "\x1b[35m";
  const RESET = "\x1b[0m";
  const GRAY = "\x1b[90m";

  if (lang === "ts" || lang === "typescript" || lang === "js" || lang === "javascript") {
    // Keywords
    let result = line
      .replace(
        /\b(import|export|from|const|let|var|function|class|interface|type|enum|async|await|return|if|else|for|while|switch|case|break|continue|new|throw|try|catch|finally|extends|implements|typeof|instanceof)\b/g,
        `${MAGENTA}$1${RESET}`,
      )
      // Strings
      .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, `${GREEN}$&${RESET}`)
      // Comments
      .replace(/(\/\/.*$)/gm, `${GRAY}$1${RESET}`)
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, `${YELLOW}$1${RESET}`)
      // Built-in types
      .replace(
        /\b(string|number|boolean|void|null|undefined|any|never|unknown|object|Array|Promise|Map|Set|Error)\b/g,
        `${CYAN}$1${RESET}`,
      );
    return result;
  }

  if (lang === "bash" || lang === "sh" || lang === "shell") {
    return line
      .replace(/^(#.*)$/gm, `${GRAY}$1${RESET}`)
      .replace(
        /\b(sudo|cd|ls|mkdir|rm|cp|mv|git|npm|pnpm|yarn|node|npx|cat|echo|export|source)\b/g,
        `${MAGENTA}$1${RESET}`,
      )
      .replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, `${GREEN}$&${RESET}`)
      .replace(/(--?\w[\w-]*)/g, `${YELLOW}$1${RESET}`);
  }

  if (lang === "json") {
    return line
      .replace(/"[^"]*"\s*:/g, `${CYAN}$&${RESET}`)
      .replace(/:\s*"[^"]*"/g, (m) => `${GREEN}${m}${RESET}`)
      .replace(/:\s*(\d+\.?\d*)/g, `${YELLOW}$1${RESET}`)
      .replace(/:\s*(true|false|null)/g, `${MAGENTA}$1${RESET}`);
  }

  // Default: no highlighting
  return line;
}

/**
 * Format inline markdown: bold, inline code.
 */
function formatInline(text: string): string {
  let result = text.replace(/\*\*(.+?)\*\*/g, "$1");
  result = result.replace(/_(.+?)_/g, "$1");
  result = result.replace(/`([^`]+)`/g, "[$1]");
  return result;
}
