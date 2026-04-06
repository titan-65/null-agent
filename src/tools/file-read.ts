import { readFile } from "node:fs/promises";
import type { ToolDefinition } from "./types.ts";
import { Object, String, toolParams } from "./schema.ts";

export const fileReadTool: ToolDefinition = {
  name: "file_read",
  description: "Read the contents of a file at the given path.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to read.",
      },
    },
    required: ["path"],
  },
  typeboxSchema: toolParams(
    {
      path: String({ description: "The path to the file to read." }),
    },
    ["path"],
  ),
  async execute(params) {
    const filePath = params["path"] as string;
    if (!filePath) {
      return { content: "Error: 'path' parameter is required.", isError: true };
    }

    try {
      const content = await readFile(filePath, "utf-8");
      return { content };
    } catch (error) {
      return {
        content: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
