import type { ToolDefinition, ToolResult } from "./types.ts";
import type { TSchema } from "@sinclair/typebox";
import { validateToolCall } from "./schema.ts";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: `Error: Unknown tool "${name}"`,
        isError: true,
      };
    }

    if (tool.typeboxSchema) {
      const validation = validateToolCall(tool.typeboxSchema, params);
      if (!validation.valid) {
        return {
          content: `Invalid parameters for ${name}: ${validation.errors}`,
          isError: true,
        };
      }
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      return {
        content: `Error executing tool "${name}": ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  toProviderTools(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.list().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
