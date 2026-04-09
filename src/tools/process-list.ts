import type { ToolDefinition } from "./types.ts";
import { toolParams } from "./schema.ts";
import { getProcessManager } from "../feet/index.ts";

const processManager = getProcessManager();

export const processListTool: ToolDefinition = {
  name: "process_list",
  description: "List all running background processes.",
  parameters: { type: "object", properties: {} },
  typeboxSchema: toolParams({}, []),
  async execute(_params) {
    const processes = processManager.list();
    return { content: JSON.stringify(processes, null, 2) };
  },
};
