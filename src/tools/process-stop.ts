import type { ToolDefinition } from "./types.ts";
import { String, Optional, Boolean, toolParams } from "./schema.ts";
import { getProcessManager } from "../feet/process-manager.ts";

const processManager = getProcessManager();

export const processStopTool: ToolDefinition = {
  name: "process_stop",
  description: "Stop a running background process.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Process ID from process_start" },
      force: { type: "boolean", description: "Use SIGKILL instead of SIGTERM" },
    },
    required: ["id"],
  },
  typeboxSchema: toolParams(
    {
      id: String({ description: "Process ID from process_start" }),
      force: Optional(Boolean({ description: "Use SIGKILL instead of SIGTERM" })),
    },
    ["id"],
  ),
  async execute(params) {
    const id = params["id"] as string;
    const force = (params["force"] as boolean) || false;

    if (!id) {
      return { content: "Error: 'id' is required", isError: true };
    }

    const result = await processManager.stop(id, force);

    if (!result.success) {
      return { content: `Failed to stop process ${id}`, isError: true };
    }

    return { content: JSON.stringify({ success: true, signal: result.signal }) };
  },
};
