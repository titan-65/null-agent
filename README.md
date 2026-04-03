# null-agent

Interactive coding assistant library with multi-provider LLM support, a built-in tool system, conversation persistence, project awareness, and multi-agent orchestration.

Use it as a library to build AI-powered developer tools, or run it directly as a CLI with four different interfaces.

## Install

```bash
npm install null-agent
# or
pnpm add null-agent
# or
yarn add null-agent
```

To use the CLI globally:

```bash
npm install -g null-agent
```

### Peer Dependencies

The TUI interface requires `ink`, `@inkjs/ui`, and `react` as peer dependencies. These are **optional** — only needed if you use the TUI mode. The library, REPL, HTTP server, and one-shot CLI all work without them.

```bash
npm install ink @inkjs/ui react  # only if using the TUI
```

## Quick Start

### As a Library

```ts
import { Agent, createProvider, createDefaultRegistry } from "null-agent";

const agent = new Agent({
  provider: createProvider("anthropic"),
  tools: createDefaultRegistry(),
  systemPrompt: "You are a helpful coding assistant.",
});

const result = await agent.chat("Explain this function");
console.log(result.content);
console.log(`Completed in ${result.iterations} iterations`);
```

### As a CLI

```bash
# Interactive TUI (default)
null-agent

# One-shot mode
null-agent "explain the auth module"

# Plain REPL
null-agent --plain

# HTTP API server
null-agent --server --port 3737
```

## Providers

null-agent supports multiple LLM providers. Set the corresponding API key as an environment variable.

| Provider  | Env Variable        | Default Model              |
| --------- | ------------------- | -------------------------- |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| OpenAI    | `OPENAI_API_KEY`    | `gpt-4o`                   |

```ts
import { createProvider } from "null-agent";

// Explicit provider
const anthropic = createProvider("anthropic");
const openai = createProvider("openai");

// With custom model
const claude = createProvider("anthropic", { model: "claude-opus-4-20250514" });
```

## Tools

null-agent ships with 10 built-in tools covering file operations, shell execution, and git workflows.

| Tool            | Name         | Description                                  |
| --------------- | ------------ | -------------------------------------------- |
| `fileReadTool`  | `file_read`  | Read file contents                           |
| `fileWriteTool` | `file_write` | Write file contents (creates parent dirs)    |
| `shellTool`     | `shell`      | Run shell commands (30s timeout, 1MB buffer) |
| `gitStatusTool` | `git_status` | Git status                                   |
| `gitDiffTool`   | `git_diff`   | Git diff                                     |
| `gitLogTool`    | `git_log`    | Git log                                      |
| `gitBranchTool` | `git_branch` | Git branches                                 |
| `gitAddTool`    | `git_add`    | Git add                                      |
| `gitCommitTool` | `git_commit` | Git commit                                   |
| `gitShowTool`   | `git_show`   | Git show                                     |

```ts
import { ToolRegistry, builtinTools, fileReadTool, shellTool } from "null-agent";

// Use all built-in tools
const registry = createDefaultRegistry();

// Or pick specific tools
const registry2 = new ToolRegistry();
registry2.register(fileReadTool);
registry2.register(shellTool);
```

### Custom Tools

```ts
registry.register({
  name: "deploy",
  description: "Deploy the application",
  parameters: {
    type: "object",
    properties: {
      environment: { type: "string", enum: ["staging", "production"] },
    },
    required: ["environment"],
  },
  execute: async ({ environment }) => {
    // your deploy logic
    return `Deployed to ${environment}`;
  },
});
```

## Interfaces

### Terminal UI

Full interactive terminal interface built with [Ink](https://github.com/vadimdemedes/ink). Features a status bar, chat panel with message bubbles, animated NullFace mascot, slash commands (`/help`, `/clear`, `/context`, `/tasks`, `/config`), and formatted tool call display.

```bash
null-agent
```

### Readline REPL

Lightweight readline-based REPL with colored output. No extra dependencies.

```bash
null-agent --plain
```

### HTTP API Server

REST API server with streaming SSE support. Default port 3737.

```bash
null-agent --server --port 3737
```

**Endpoints:**

| Method   | Path             | Description                  |
| -------- | ---------------- | ---------------------------- |
| `POST`   | `/chat`          | Send a message, get response |
| `POST`   | `/chat/stream`   | Stream response via SSE      |
| `GET`    | `/history`       | Get conversation history     |
| `DELETE` | `/history`       | Clear conversation history   |
| `GET`    | `/conversations` | List saved conversations     |
| `POST`   | `/conversations` | Create/load a conversation   |
| `GET`    | `/tasks`         | List tasks                   |
| `POST`   | `/tasks`         | Add a task                   |
| `PATCH`  | `/config`        | Update config                |
| `GET`    | `/health`        | Health check                 |

### One-Shot CLI

Send a single message and print the response. Good for scripting.

```bash
null-agent "what does this function do?"
null-agent --provider openai "summarize the changes"
```

## Configuration

### Personality

Control the agent's behavior:

```ts
import { loadConfig, saveConfig } from "null-agent";

const config = loadConfig();
config.personality = {
  tone: "casual", // "professional" | "casual" | "concise"
  verbosity: "balanced", // "minimal" | "balanced" | "detailed"
  proactivity: "active", // "passive" | "balanced" | "active"
};
saveConfig(config);
```

Config is persisted at `~/.null-agent/config.json`.

### Unified Config

Layered config loading: defaults < env vars < `~/.null-agent.json` < `.null-agent.json` in project root.

```ts
import { loadUnifiedConfig } from "null-agent";

const config = loadUnifiedConfig("./my-project");
// config.provider, config.personality, config.permissions, etc.
```

## Memory

Conversations are persisted to disk at `~/.null-agent/memory/`.

```ts
import { Agent, MemoryStore } from "null-agent";

const memory = new MemoryStore();
const agent = new Agent({ provider, tools, memory });

// Resume a previous conversation
await agent.resumeConversation("conversation-id");

// List saved conversations
const conversations = await memory.listConversations();
```

## Project Scanning

null-agent can analyze your project to understand its structure:

```ts
import { scanProject } from "null-agent";

const knowledge = await scanProject("./my-project");
console.log(knowledge.language); // "typescript"
console.log(knowledge.framework); // "react"
console.log(knowledge.packageManager); // "pnpm"
console.log(knowledge.testCommand); // "vitest"
```

## Orchestrator

The agent can spawn parallel sub-agents for complex tasks:

```ts
import { Agent, createProvider, createDefaultRegistry } from "null-agent";

const agent = new Agent({
  provider: createProvider("anthropic"),
  tools: createDefaultRegistry(),
  enableOrchestrator: true,
});

// The agent can use the "spawn_task" tool to delegate work
const result = await agent.chat("Refactor these 3 files in parallel");
```

Concurrency is capped at 5 concurrent sub-agents, 3 spawns per turn, 30s timeout per sub-agent.

## Plugin System

Extend null-agent with custom plugins:

```ts
import { PluginManager } from "null-agent";

const plugin = {
  name: "my-plugin",
  version: "1.0.0",
  setup(context) {
    context.addTool({
      name: "my_tool",
      description: "Does something useful",
      parameters: { type: "object", properties: {} },
      execute: async () => "done",
    });
    context.on("agent:text", (text) => {
      console.log("Agent said:", text);
    });
  },
};

const manager = new PluginManager();
manager.register(plugin);
```

## Awareness

Real-time git monitoring and file watching:

```ts
import { AwarenessManager } from "null-agent";

const awareness = new AwarenessManager();
awareness.on("git:change", (event) => {
  console.log("Git changed:", event);
});
awareness.on("file:modify", (event) => {
  console.log("File modified:", event.path);
});
await awareness.start();
```

## CLI Reference

```
null-agent - Interactive coding assistant

Usage:
  null-agent                  Start interactive TUI
  null-agent "your message"   One-shot mode
  null-agent --plain          Start plain readline REPL
  null-agent --server         Start HTTP API server
  null-agent --help           Show this help

Options:
  --provider <name>   LLM provider (openai, anthropic)
  --model <name>      Model name
  --plain             Use plain readline instead of TUI
  --server            Start HTTP API server
  --port <number>     Server port (default: 3737)
  --host <address>    Server host (default: 127.0.0.1)

Environment:
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
```

## License

MIT
