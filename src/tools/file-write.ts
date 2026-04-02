import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDefinition } from "./types.ts";

export const fileWriteTool: ToolDefinition = {
  name: "file_write",
  description: "Write content to a file at the given path. Creates parent directories if needed.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to write.",
      },
      content: {
        type: "string",
        description: "The content to write to the file.",
      },
    },
    required: ["path", "content"],
  },
  async execute(params) {
    const filePath = params["path"] as string;
    const content = params["content"] as string;

    if (!filePath) {
      return { content: "Error: 'path' parameter is required.", isError: true };
    }

    if (content === undefined) {
      return {
        content: "Error: 'content' parameter is required.",
        isError: true,
      };
    }

    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return { content: `Successfully wrote to ${filePath}` };
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
