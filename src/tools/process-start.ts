import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";
import { getProcessManager } from "../feet/process-manager.ts";

const processManager = getProcessManager();

export const processStartTool: ToolDefinition = {
  name: "process_start",
  description: "Start a background process.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command to run" },
      name: { type: "string", description: "Optional friendly name" },
      cwd: { type: "string", description: "Working directory" },
    },
    required: ["command"],
  },
  typeboxSchema: toolParams(
    {
      command: String({ description: "Command to run" }),
      name: Optional(String({ description: "Optional friendly name" })),
      cwd: Optional(String({ description: "Working directory" })),
    },
    ["command"],
  ),
  async execute(params) {
    const command = params["command"] as string;
    const name = params["name"] as string | undefined;
    const cwd = (params["cwd"] as string) || process.cwd();

    if (!command) {
      return { content: "Error: 'command' is required", isError: true };
    }

    try {
      const proc = await processManager.start({ command, name, cwd });
      return { content: JSON.stringify({ id: proc.id, pid: proc.pid, name: proc.name }) };
    } catch (error) {
      return {
        content: `Error starting process: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
