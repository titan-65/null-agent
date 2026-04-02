import type { ToolDefinition } from "./types.ts";
import type { Orchestrator } from "../agent/orchestrator.ts";

export function createSpawnTool(orchestrator: Orchestrator): ToolDefinition {
  return {
    name: "spawn_task",
    description:
      "Spawn sub-agents to work on tasks in parallel. Use this when you need to investigate multiple things at once or when a task can be broken into independent parts. Each sub-agent works independently and returns its result.",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to spawn sub-agents for.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description:
                  "What the sub-agent should do. Be specific — include file paths, commands, or questions.",
              },
              context: {
                type: "string",
                description:
                  "Optional context to help the sub-agent (e.g., relevant code snippets, error messages).",
              },
            },
            required: ["description"],
          },
        },
      },
      required: ["tasks"],
    },
    async execute(params) {
      const tasks = params["tasks"] as Array<{
        description: string;
        context?: string;
      }>;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return {
          content: "Error: 'tasks' must be a non-empty array of task descriptions.",
          isError: true,
        };
      }

      if (tasks.length > 5) {
        return {
          content: "Error: Maximum 5 tasks per spawn call.",
          isError: true,
        };
      }

      orchestrator.resetTurnCount();
      const results = await orchestrator.spawnParallel(tasks);

      // Format results for the main agent
      const formatted = results.map((r) => {
        const lines: string[] = [];
        lines.push(`### Task: ${r.description}`);

        if (r.error) {
          lines.push(`Error: ${r.error}`);
        } else {
          lines.push(r.content || "(no result)");
        }

        if (r.toolCalls.length > 0) {
          lines.push(`Tools used: ${r.toolCalls.map((tc) => tc.name).join(", ")}`);
        }

        lines.push(`Iterations: ${r.iterations}`);
        return lines.join("\n");
      });

      return {
        content: formatted.join("\n\n---\n\n"),
      };
    },
  };
}
