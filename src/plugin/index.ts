import type { ToolDefinition } from "../tools/types.ts";
import type { EventBus } from "../bus/index.ts";

export interface PluginContext {
  bus: EventBus;
  registerTool(tool: ToolDefinition): void;
  getProjectDir(): string;
}

export interface NullAgentPlugin {
  name: string;
  version: string;
  description?: string;
  setup(context: PluginContext): void | Promise<void>;
  teardown?(): void | Promise<void>;
}

export class PluginManager {
  private plugins = new Map<string, NullAgentPlugin>();
  private bus: EventBus;
  private tools: ToolDefinition[] = [];
  private projectDir: string;

  constructor(bus: EventBus, projectDir: string) {
    this.bus = bus;
    this.projectDir = projectDir;
  }

  async register(plugin: NullAgentPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      return; // Already registered
    }

    const context: PluginContext = {
      bus: this.bus,
      registerTool: (tool) => {
        this.tools.push(tool);
      },
      getProjectDir: () => this.projectDir,
    };

    await plugin.setup(context);
    this.plugins.set(plugin.name, plugin);
  }

  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin?.teardown) {
      await plugin.teardown();
    }
    this.plugins.delete(name);
  }

  getTools(): ToolDefinition[] {
    return [...this.tools];
  }

  getPlugins(): NullAgentPlugin[] {
    return Array.from(this.plugins.values());
  }

  async unloadAll(): Promise<void> {
    for (const [name] of this.plugins) {
      await this.unregister(name);
    }
    this.tools = [];
  }
}

// Built-in plugin: File tools
export function createFileToolsPlugin(): NullAgentPlugin {
  return {
    name: "file-tools",
    version: "1.0.0",
    description: "Read, write, and manage files",
    setup(context) {
      // Import and register file tools
      import("../tools/file-read.ts").then((m) => context.registerTool(m.fileReadTool));
      import("../tools/file-write.ts").then((m) => context.registerTool(m.fileWriteTool));
    },
  };
}

// Built-in plugin: Shell tool
export function createShellPlugin(): NullAgentPlugin {
  return {
    name: "shell",
    version: "1.0.0",
    description: "Execute shell commands",
    setup(context) {
      import("../tools/shell.ts").then((m) => context.registerTool(m.shellTool));
    },
  };
}

// Built-in plugin: Git tools
export function createGitPlugin(): NullAgentPlugin {
  return {
    name: "git",
    version: "1.0.0",
    description: "Git operations",
    setup(context) {
      import("../tools/git.ts").then((m) => context.registerTool(m.gitTools));
    },
  };
}

// Built-in plugin: Multi-agent
export function createOrchestratorPlugin(): NullAgentPlugin {
  return {
    name: "orchestrator",
    version: "1.0.0",
    description: "Multi-agent orchestration",
    setup(_context) {
      // Orchestrator tools are registered by the Agent constructor
      // This plugin is a placeholder for future extensibility
    },
  };
}
