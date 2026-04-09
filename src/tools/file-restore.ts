import type { ToolDefinition } from "./types.ts";
import { String, Optional, Boolean, toolParams } from "./schema.ts";
import { getTrashEntries, restore as restoreFromTrash } from "./trash.ts";

export const fileRestoreTool: ToolDefinition = {
  name: "file_restore",
  description: "Restore a file from trash or list all trash entries.",
  parameters: {
    type: "object",
    properties: {
      trashPath: { type: "string", description: "Trash path of the file to restore" },
      list: { type: "boolean", description: "List all trash entries" },
    },
    required: [],
  },
  typeboxSchema: toolParams(
    {
      trashPath: Optional(String({ description: "Trash path of the file to restore" })),
      list: Optional(Boolean({ description: "List all trash entries" })),
    },
    [],
  ),
  async execute(params) {
    const trashPath = params["trashPath"] as string | undefined;
    const list = params["list"] as boolean | undefined;

    if (list) {
      const entries = await getTrashEntries();
      return { content: JSON.stringify(entries, null, 2) };
    }

    if (!trashPath) {
      return { content: "Error: 'trashPath' or 'list' is required", isError: true };
    }

    try {
      const result = await restoreFromTrash(trashPath);
      if (typeof result === "object" && result !== null && "isError" in result) {
        return { content: `Error restoring: ${result.content}`, isError: true };
      }
      return { content: `Restored ${result}` };
    } catch (error) {
      return {
        content: `Error restoring: ${error instanceof Error ? error.message : "" + error}`,
        isError: true,
      };
    }
  },
};
