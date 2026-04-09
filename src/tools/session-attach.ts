import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";
import { globalSessionManager } from "../feet/session-manager.ts";

export const sessionAttachTool: ToolDefinition = {
  name: "session_attach",
  description: "Attach to a terminal session and run a command.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Session ID from session_create" },
      command: { type: "string", description: "Optional command to run" },
    },
    required: ["id"],
  },
  typeboxSchema: toolParams(
    {
      id: String({ description: "Session ID from session_create" }),
      command: Optional(String({ description: "Optional command to run" })),
    },
    ["id"],
  ),
  async execute(params) {
    const id = params["id"] as string;
    const command = params["command"] as string | undefined;

    if (!id) {
      return { content: "Error: 'id' is required", isError: true };
    }

    try {
      const result = await globalSessionManager.attach(id, command);
      return { content: JSON.stringify(result) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: `Error attaching to session: ${message}`,
        isError: true,
      };
    }
  },
};
