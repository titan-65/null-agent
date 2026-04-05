import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Conversation } from "../memory/types.ts";

export interface ExportOptions {
  format: "markdown" | "json" | "html";
  outputPath?: string;
  includeToolCalls?: boolean;
  includeMetadata?: boolean;
}

export async function exportConversation(
  conversation: Conversation,
  options: ExportOptions,
): Promise<string> {
  switch (options.format) {
    case "markdown":
      return exportMarkdown(conversation, options);
    case "json":
      return exportJson(conversation);
    case "html":
      return exportHtml(conversation);
    default:
      return exportMarkdown(conversation, options);
  }
}

export async function exportToFile(
  conversation: Conversation,
  options: ExportOptions,
): Promise<string> {
  const content = await exportConversation(conversation, options);
  const ext = options.format === "markdown" ? "md" : options.format;
  const filename = `conversation-${conversation.id}.${ext}`;
  const dir = options.outputPath ?? process.cwd();
  const filepath = join(dir, filename);

  await mkdir(dir, { recursive: true });
  await writeFile(filepath, content, "utf-8");

  return filepath;
}

function exportMarkdown(conversation: Conversation, options: ExportOptions): string {
  const lines: string[] = [];

  lines.push(`# Conversation: ${conversation.title}`);
  lines.push("");

  if (options.includeMetadata) {
    lines.push(`**Date:** ${conversation.createdAt}`);
    lines.push(`**Updated:** ${conversation.updatedAt}`);
    lines.push(`**Messages:** ${conversation.metadata.messageCount}`);
    lines.push(`**Project:** ${conversation.metadata.projectName}`);
    lines.push(`**Provider:** ${conversation.metadata.provider}`);
    lines.push(`**Model:** ${conversation.metadata.model}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  for (const msg of conversation.messages) {
    if (msg.role === "system") {
      lines.push(`> ${msg.content}`);
      lines.push("");
      continue;
    }

    if (msg.role === "user") {
      lines.push(`## You`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
      continue;
    }

    if (msg.role === "assistant") {
      lines.push(`## Assistant`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function exportJson(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2);
}

function exportHtml(conversation: Conversation): string {
  const messages = conversation.messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
      const color =
        msg.role === "user" ? "#2563eb" : msg.role === "assistant" ? "#059669" : "#6b7280";
      return `<div style="margin-bottom: 16px;">
  <strong style="color: ${color}">${role}</strong>
  <pre style="white-space: pre-wrap; font-family: inherit; margin: 4px 0 0 0;">${escapeHtml(msg.content)}</pre>
</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(conversation.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1f2937; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title)}</h1>
  <p><small>Exported: ${new Date().toISOString()}</small></p>
  <hr>
  ${messages}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
