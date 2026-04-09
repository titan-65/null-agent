import { resolve, isAbsolute } from "node:path";
import type { ToolDefinition } from "./types.ts";
import { String, Object, Optional, toolParams } from "./schema.ts";
import { moveToTrash } from "./trash.ts";

export const fileDeleteTool: ToolDefinition = {
  name: "file_delete",
  description: "Delete a file by moving it to trash. Supports restore via file_restore tool.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to delete" },
      rootBoundary: { type: "string", description: "Root boundary for path validation" },
    },
    required: ["path"],
  },
  typeboxSchema: toolParams(
    {
      path: String({ description: "Path to the file to delete" }),
      rootBoundary: Optional(String({ description: "Root boundary for path validation" })),
    },
    ["path"],
  ),
  async execute(params) {
    const path = params["path"] as string;
    const rootBoundary = (params["rootBoundary"] as string) || process.cwd();

    if (!path) {
      return { content: "Error: 'path' is required", isError: true };
    }

    const resolvedPath = isAbsolute(path) ? path : resolve(rootBoundary, path);

    try {
      const entry = await moveToTrash(resolvedPath, rootBoundary);
      if (entry && typeof entry === "object" && "isError" in entry) {
        return entry as { isError: true; content: string };
      }
      return { content: `Deleted ${path}. Moved to trash. Use file_restore to undo.` };
    } catch (error) {
      return {
        content: `Error deleting file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
