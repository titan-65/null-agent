import type { TSchema } from "@sinclair/typebox";

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (legacy)
  typeboxSchema?: TSchema; // TypeBox schema for type-safe validation
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}
