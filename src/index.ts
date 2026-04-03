// Providers
export type {
  ChatOptions,
  Message,
  Provider,
  ProviderToolDefinition,
  StreamChunk,
  ToolCall,
  ToolCallRequest,
  ToolResult,
} from "./providers/types.ts";
export { BaseProvider } from "./providers/base.ts";
export { OpenAIProvider } from "./providers/openai.ts";
export { AnthropicProvider } from "./providers/anthropic.ts";
export {
  createProvider,
  detectProvider,
  getAvailableProviders,
  getFreeProviders,
  ProviderError,
  PROVIDERS,
} from "./providers/index.ts";
export type { ProviderName, ProviderInfo } from "./providers/index.ts";

// Tools
export type { ToolDefinition, ToolResult as ToolResultType } from "./tools/types.ts";
export { ToolRegistry } from "./tools/registry.ts";
export { fileReadTool } from "./tools/file-read.ts";
export { fileWriteTool } from "./tools/file-write.ts";
export { shellTool } from "./tools/shell.ts";
export {
  gitAddTool,
  gitBranchTool,
  gitCommitTool,
  gitDiffTool,
  gitLogTool,
  gitShowTool,
  gitStatusTool,
  gitTools,
} from "./tools/git.ts";
export { builtinTools, createDefaultRegistry } from "./tools/index.ts";

// Agent
export type { AgentCallbacks, AgentConfig, AgentResult } from "./agent/types.ts";
export { Agent } from "./agent/index.ts";
export type { Task, TaskList } from "./agent/tasks.ts";
export { createTask, extractTasks, formatTaskList, markTaskDone } from "./agent/tasks.ts";
export type { Suggestion } from "./agent/suggestions.ts";
export {
  generateSuggestions,
  getHighestPrioritySuggestion,
  formatSuggestion,
} from "./agent/suggestions.ts";
export type { OrchestratorConfig, SubAgentResult } from "./agent/orchestrator.ts";
export { Orchestrator } from "./agent/orchestrator.ts";
export { createSpawnTool } from "./tools/spawn.ts";
export type {
  PersonalityConfig,
  NullAgentConfig,
  Tone,
  Verbosity,
  Proactivity,
} from "./agent/personality.ts";
export { loadConfig, saveConfig, getPersonalityPrompt, formatConfig } from "./agent/personality.ts";
export type { ContextualGreeting, GreetingOptions, GreetingContext } from "./agent/greetings.ts";
export { generateGreeting, getTimeOfDay } from "./agent/greetings.ts";

// Memory
export type { Conversation, ConversationMetadata, ConversationSummary } from "./memory/types.ts";
export { MemoryStore, createConversation, updateConversation } from "./memory/store.ts";

// Context
export type { ProjectKnowledge, ProjectConventions } from "./context/types.ts";
export { formatProjectKnowledge } from "./context/types.ts";
export { scanProject } from "./context/scanner.ts";

// Awareness
export type {
  AwarenessConfig,
  AwarenessEvent,
  AwarenessEventType,
  AwarenessCallbacks,
} from "./awareness/types.ts";
export { formatEvent } from "./awareness/types.ts";
export { AwarenessManager } from "./awareness/manager.ts";
export { GitMonitor, type GitState } from "./awareness/git.ts";
export { FileWatcher } from "./awareness/watcher.ts";

// Event Bus
export type { EventBusEvent, EventHandler } from "./bus/index.ts";
export { EventBus, Events } from "./bus/index.ts";

// Config
export type {
  NullAgentConfig as UnifiedConfig,
  PersonalityConfig as ConfigPersonality,
  PermissionConfig,
  ProviderConfig,
} from "./config/index.ts";
export { loadConfig as loadUnifiedConfig } from "./config/index.ts";

// Permission
export type { OperationType, PermissionRequest, PermissionResolver } from "./permission/index.ts";
export { PermissionManager, formatPermissionRequest, classifyRisk } from "./permission/index.ts";

// Plugin
export type { PluginContext, NullAgentPlugin } from "./plugin/index.ts";
export {
  PluginManager,
  createFileToolsPlugin,
  createShellPlugin,
  createGitPlugin,
} from "./plugin/index.ts";

// Command
export type { Command, CommandResult, CommandHistory } from "./command/index.ts";
export { CommandManager, createToolCommand } from "./command/index.ts";
