import type { ToolDefinition } from "./types.ts";
import { String, Integer, Optional, toolParams } from "./schema.ts";

export const taskSprintTool: ToolDefinition = {
  name: "task_sprint",
  description: "Run a bounded agent task with timeout. Agent works toward goal with checkpointing.",
  parameters: {
    type: "object",
    properties: {
      task: { type: "string", description: "Task description" },
      timeout: { type: "number", description: "Timeout in seconds" },
      goal: { type: "string", description: "Optional explicit goal" },
    },
    required: ["task", "timeout"],
  },
  typeboxSchema: toolParams(
    {
      task: String({ description: "Task description" }),
      timeout: Integer({ description: "Timeout in seconds" }),
      goal: Optional(String({ description: "Optional explicit goal" })),
    },
    ["task", "timeout"],
  ),
  async execute(params) {
    const task = params["task"] as string;
    const timeout = params["timeout"] as number;
    const goal = params["goal"] as string | undefined;

    if (!task || !timeout) {
      return { content: "Error: 'task' and 'timeout' are required", isError: true };
    }

    return {
      content: JSON.stringify({
        completed: false,
        progress: `Sprint started for task: ${task}`,
        iterations: 0,
        timeout,
        goal: goal || task,
        message: "Task sprint executed. Full agent integration pending.",
      }),
    };
  },
};
