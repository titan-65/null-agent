import type { Message } from "../providers/types.ts";
import type { AgentCallbacks, AgentConfig, AgentResult } from "./types.ts";
import { runAgent } from "./loop.ts";
import { Orchestrator } from "./orchestrator.ts";
import {
  type Conversation,
  createConversation,
  updateConversation,
  updateConversationModel,
} from "../memory/store.ts";
import { type Task, createTask, extractTasks, markTaskDone } from "./tasks.ts";
import { createSpawnTool } from "../tools/spawn.ts";
import { AgentEventEmitter, createAgentEvent, type AgentEventHandlers } from "./events.ts";

export type { AgentCallbacks, AgentConfig, AgentResult, AgentState } from "./types.ts";
export type { AgentEvent, AgentEventType, AgentEventHandlers } from "./events.ts";
export { AgentEventEmitter, createAgentEvent };

export class Agent {
  private config: AgentConfig;
  private history: Message[] = [];
  private conversation: Conversation | null = null;
  private tasks: Task[] = [];
  private orchestrator: Orchestrator | null = null;
  private eventEmitter: AgentEventEmitter;
  private steeringQueue: Message[] = [];
  private followUpQueue: Array<() => Promise<void>> = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.eventEmitter = new AgentEventEmitter();

    if (config.eventHandlers) {
      this.eventEmitter.setHandlers(config.eventHandlers);
    }

    if (config.toolHooks) {
      this.config = { ...config, toolHooks: config.toolHooks };
    }

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
    // Inject any steering messages
    if (this.steeringQueue.length > 0) {
      this.history = [...this.steeringQueue, ...this.history];
      this.steeringQueue = [];
    }

    const result = await runAgent(
      this.config,
      message,
      this.history,
      callbacks,
      this.config.toolHooks,
      this.eventEmitter,
    );

    await this.eventEmitter.waitForSettled();

    // Use the full history from runAgent which includes tool results
    this.history = result.history;

    if (result.content) {
      const extractedTasks = extractTasks(result.content);
      for (const desc of extractedTasks) {
        if (!this.tasks.some((t) => t.description === desc && t.status !== "done")) {
          this.tasks.push(createTask(desc, "conversation"));
        }
      }
    }

    if (this.config.memory) {
      await this.saveToMemory();
    }

    // Process follow-up queue
    if (this.followUpQueue.length > 0) {
      const followUps = [...this.followUpQueue];
      this.followUpQueue = [];
      for (const followUp of followUps) {
        await followUp();
      }
    }

    return result;
  }

  steer(message: Message): void {
    this.steeringQueue.push(message);
  }

  followUp(fn: () => Promise<void>): void {
    this.followUpQueue.push(fn);
  }

  clearAllQueues(): void {
    this.steeringQueue = [];
    this.followUpQueue = [];
  }

  setEventHandlers(handlers: AgentEventHandlers): void {
    this.eventEmitter.setHandlers(handlers);
  }

  getEventEmitter(): AgentEventEmitter {
    return this.eventEmitter;
  }

  async loadConversation(projectDir?: string): Promise<Conversation | null> {
    if (!this.config.memory) return null;

    const existing = await this.config.memory.getLatestConversation(projectDir);
    if (existing) {
      this.conversation = existing;
      this.history = [...existing.messages];
      if (existing.metadata.model) {
        this.config.model = existing.metadata.model;
      }
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
      if (existing.metadata.model) {
        this.config.model = existing.metadata.model;
      }
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

  async setModel(model: string): Promise<void> {
    this.config.model = model;
    if (this.conversation && this.config.memory) {
      try {
        this.conversation = updateConversationModel(this.conversation, model);
        await this.config.memory.saveConversation(this.conversation);
      } catch (error) {
        console.error("Failed to save model change to memory:", error);
      }
    }
  }

  getModel(): string | undefined {
    return this.config.model;
  }

  getProviderName(): string | undefined {
    return this.conversation?.metadata.provider;
  }

  getProvider(): unknown {
    return this.config.provider;
  }

  private _lastToolUsed?: string;

  private async saveToMemory(): Promise<void> {
    if (!this.config.memory || !this.conversation) return;

    this.conversation = updateConversation(this.conversation, this.history);
    await this.config.memory.saveConversation(this.conversation);
  }
}
