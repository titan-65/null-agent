import type { Provider } from "../providers/types.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { runAgent } from "./loop.ts";

export interface SubAgentResult {
  description: string;
  content: string;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  iterations: number;
  error?: string;
}

export interface OrchestratorConfig {
  provider: Provider;
  tools: ToolRegistry;
  model?: string;
  maxConcurrent?: number;
  maxSpawnsPerTurn?: number;
  maxIterationsPerAgent?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_CONCURRENT = 5;
const DEFAULT_MAX_SPAWNS_PER_TURN = 3;
const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

export class Orchestrator {
  private config: OrchestratorConfig;
  private activeCount = 0;
  private spawnCount = 0;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  resetTurnCount(): void {
    this.spawnCount = 0;
  }

  async spawnTask(description: string, context?: string): Promise<SubAgentResult> {
    if (this.spawnCount >= (this.config.maxSpawnsPerTurn ?? DEFAULT_MAX_SPAWNS_PER_TURN)) {
      return {
        description,
        content: "",
        toolCalls: [],
        iterations: 0,
        error: `Max spawns per turn reached (${this.config.maxSpawnsPerTurn ?? DEFAULT_MAX_SPAWNS_PER_TURN})`,
      };
    }

    if (this.activeCount >= (this.config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT)) {
      return {
        description,
        content: "",
        toolCalls: [],
        iterations: 0,
        error: `Max concurrent agents reached (${this.config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT})`,
      };
    }

    this.spawnCount++;
    this.activeCount++;

    try {
      const systemPrompt = buildSubAgentPrompt(context);
      const result = await this.runWithTimeout(
        runAgent(
          {
            provider: this.config.provider,
            tools: this.config.tools,
            model: this.config.model,
            maxIterations: this.config.maxIterationsPerAgent ?? DEFAULT_MAX_ITERATIONS,
            systemPrompt,
          },
          description,
          [],
        ),
        this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      return {
        description,
        content: result.content,
        toolCalls: result.toolCalls,
        iterations: result.iterations,
      };
    } catch (error) {
      return {
        description,
        content: "",
        toolCalls: [],
        iterations: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.activeCount--;
    }
  }

  async spawnParallel(
    tasks: Array<{ description: string; context?: string }>,
  ): Promise<SubAgentResult[]> {
    const results = await Promise.all(
      tasks.map((task) => this.spawnTask(task.description, task.context)),
    );
    return results;
  }

  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Sub-agent timeout")), timeoutMs),
      ),
    ]);
  }
}

function buildSubAgentPrompt(context?: string): string {
  const parts = [
    "You are a focused sub-agent working on a specific task. Complete the task efficiently.",
    "",
    "Rules:",
    "- Focus only on the given task. Don't explore unrelated areas.",
    "- Be concise. Return the result directly.",
    "- You cannot spawn more sub-agents.",
    "- If the task requires reading files, read them and report what you find.",
    "- If the task requires running commands, run them and report the output.",
  ];

  if (context) {
    parts.push("");
    parts.push("## Additional Context");
    parts.push(context);
  }

  return parts.join("\n");
}
