import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";
import { SessionManager } from "../feet/session-manager.ts";

const sessionManager = new SessionManager();

export const sessionCreateTool: ToolDefinition = {
  name: "session_create",
  description: "Create a new terminal session.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Optional friendly name" },
      cwd: { type: "string", description: "Working directory" },
    },
  },
  typeboxSchema: toolParams(
    {
      name: Optional(String({ description: "Optional friendly name" })),
      cwd: Optional(String({ description: "Working directory" })),
    },
    [],
  ),
  async execute(params) {
    const name = params["name"] as string | undefined;
    const cwd = (params["cwd"] as string) || process.cwd();

    try {
      const session = await sessionManager.create({ name, cwd });
      return { content: JSON.stringify({ id: session.id, name: session.name }) };
    } catch (error) {
      return {
        content: `Error creating session: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
