import type { Message } from "../providers/types.ts";
import type { AgentCallbacks, AgentConfig, AgentResult } from "./types.ts";
import { runAgent } from "./loop.ts";
import { Orchestrator } from "./orchestrator.ts";
import { type Conversation, createConversation, updateConversation } from "../memory/store.ts";
import { type Task, createTask, extractTasks, markTaskDone } from "./tasks.ts";
import { createSpawnTool } from "../tools/spawn.ts";

export type { AgentCallbacks, AgentConfig, AgentResult } from "./types.ts";

export class Agent {
  private config: AgentConfig;
  private history: Message[] = [];
  private conversation: Conversation | null = null;
  private tasks: Task[] = [];
  private orchestrator: Orchestrator | null = null;

  constructor(config: AgentConfig) {
    this.config = config;

    // Set up orchestrator and spawn_task tool if enabled
    if (config.enableOrchestrator !== false) {
      this.orchestrator = new Orchestrator({
        provider: config.provider,
        tools: config.tools,
        model: config.model,
      });

      const spawnTool = createSpawnTool(this.orchestrator);
      config.tools.register(spawnTool);
    }
  }

  async chat(message: string, callbacks?: AgentCallbacks): Promise<AgentResult> {
    const result = await runAgent(this.config, message, this.history, callbacks);

    // Update history
    this.history.push({ role: "user", content: message });
    if (result.content) {
      this.history.push({ role: "assistant", content: result.content });

      // Extract tasks from assistant response
      const extractedTasks = extractTasks(result.content);
      for (const desc of extractedTasks) {
        // Don't add duplicates
        if (!this.tasks.some((t) => t.description === desc && t.status !== "done")) {
          this.tasks.push(createTask(desc, "conversation"));
        }
      }
    }

    // Save to memory if configured
    if (this.config.memory) {
      await this.saveToMemory();
    }

    return result;
  }

  async loadConversation(projectDir?: string): Promise<Conversation | null> {
    if (!this.config.memory) return null;

    const existing = await this.config.memory.getLatestConversation(projectDir);
    if (existing) {
      this.conversation = existing;
      this.history = [...existing.messages];
      return existing;
    }

    return null;
  }

  async startConversation(
    projectDir: string,
    projectName: string,
    provider: string,
    model: string,
  ): Promise<Conversation> {
    this.conversation = createConversation(projectDir, projectName, provider, model);
    return this.conversation;
  }

  async resumeConversation(id: string): Promise<Conversation | null> {
    if (!this.config.memory) return null;

    const existing = await this.config.memory.loadConversation(id);
    if (existing) {
      this.conversation = existing;
      this.history = [...existing.messages];
      return existing;
    }

    return null;
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  getConversation(): Conversation | null {
    return this.conversation;
  }

  // Task management
  getTasks(): Task[] {
    return [...this.tasks];
  }

  getOpenTasks(): Task[] {
    return this.tasks.filter((t) => t.status !== "done");
  }

  addTask(description: string): Task {
    const task = createTask(description, "manual");
    this.tasks.push(task);
    return task;
  }

  completeTask(id: string): Task | null {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;

    const updated = markTaskDone(task);
    this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
    return updated;
  }

  getLastToolUsed(): string | undefined {
    return this._lastToolUsed;
  }

  setLastToolUsed(name: string): void {
    this._lastToolUsed = name;
  }

  private _lastToolUsed?: string;

  private async saveToMemory(): Promise<void> {
    if (!this.config.memory || !this.conversation) return;

    this.conversation = updateConversation(this.conversation, this.history);
    await this.config.memory.saveConversation(this.conversation);
  }
}
