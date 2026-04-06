import type { Provider } from "../providers/types.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { ProjectKnowledge } from "../context/types.ts";
import type { PersonalityConfig } from "./personality.ts";
import type { PermissionManager } from "../permission/index.ts";
import type { AgentEventHandlers } from "./events.ts";
import type { ToolHookConfig } from "./loop.ts";

export interface AgentConfig {
  provider: Provider;
  tools: ToolRegistry;
  systemPrompt?: string;
  model?: string;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  memory?: MemoryStore;
  projectKnowledge?: ProjectKnowledge;
  personality?: PersonalityConfig;
  enableOrchestrator?: boolean;
  permissions?: PermissionManager;
  toolHooks?: ToolHookConfig;
  eventHandlers?: AgentEventHandlers;
}

export interface AgentResult {
  content: string;
  iterations: number;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export interface AgentCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
}

export interface AgentState {
  systemPrompt: string;
  model: string;
  tools: ToolRegistry;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isProcessing: boolean;
  pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}
