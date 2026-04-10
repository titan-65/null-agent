# null-agent

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.19-brightgreen?style=for-the-badge&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/typescript-6.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-182%2F182%20passing-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/tools-49%20built--in-orange?style=for-the-badge" alt="Tools" />
  <img src="https://img.shields.io/badge/providers-5%20LLMs-purple?style=for-the-badge" alt="Providers" />
  <img src="https://img.shields.io/badge/build-passing-success?style=for-the-badge&logo=vite" alt="Build" />
</p>

Interactive coding assistant library with multi-provider LLM support, a rich terminal UI, tool system, conversation memory, project awareness, and multi-agent orchestration.

Use it as a **library** to build AI-powered developer tools, or run it directly as a **CLI** with four different interfaces.

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

### First-Time Setup

```bash
# Interactive setup — pick a provider, enter your key
null-agent auth

# Or configure one provider directly
null-agent auth openai

# Check which providers are configured
null-agent auth status
```

Keys are stored securely in the OS keychain (macOS Keychain / Windows Credential Manager) and loaded automatically on startup.

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

# Plain REPL (no TUI dependencies)
null-agent --plain

# HTTP API server
null-agent --server --port 3737
```

## Providers

null-agent supports 5 LLM providers. Auto-detects which provider has a key configured.

| Provider      | Env Variable         | Default Model                 | Free Models                            |
| ------------- | -------------------- | ----------------------------- | -------------------------------------- |
| OpenAI        | `OPENAI_API_KEY`     | `gpt-5.4`                     | —                                      |
| Anthropic     | `ANTHROPIC_API_KEY`  | `claude-sonnet-4-6`           | —                                      |
| Google Gemini | `GEMINI_API_KEY`     | `gemini-3.1-flash`            | `gemini-3.1-flash` (free tier)         |
| OpenRouter    | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-4-6` | `google/gemini-3.1-flash`, `llama-3.1` |
| Tavily        | `TAVILY_API_KEY`     | —                             | 1000 searches/month (free tier)        |

```ts
import { createProvider, detectProvider, getAvailableProviders } from "null-agent";

// Auto-detect provider from available keys
const provider = createProvider(detectProvider() ?? "openai");

// Explicit provider with custom model
const claude = createProvider("anthropic", { model: "claude-opus-4-20250514" });

// List available providers
const available = getAvailableProviders(); // ["openai", "gemini"]
```

### Free Options

No API key? Start free:

```bash
# Gemini free tier
export GEMINI_API_KEY='...'
null-agent

# OpenRouter free models
export OPENROUTER_API_KEY='...'
null-agent --provider openrouter
```

Get a free Gemini key: https://aistudio.google.com/apikey
Get a free OpenRouter key: https://openrouter.ai/keys

## Authentication

### Interactive Setup

```bash
null-agent auth              # Pick a provider, enter key interactively
null-agent auth openai       # Configure one provider directly
null-agent auth tavily       # Configure Tavily API key
null-agent auth status       # Show which providers are configured
```

### How Keys Are Resolved

1. Environment variable (highest priority)
2. OS keychain storage (via keytar)
3. `.null-agent.json` config file

### Setting Keys

```bash
# Environment variables (session-only)
export OPENAI_API_KEY='sk-...'
export GEMINI_API_KEY='...'
export TAVILY_API_KEY='tvly-...'

# Or use the auth command (persistent)
null-agent auth openai
```

## Tools

null-agent ships with 49 built-in tools organized into three capability areas: Mind (reasoning), Hand (file manipulation), and Feet (task orchestration).

### Mind (Core)

Foundational tools for reading, writing, and shell execution.

| Tool            | Name         | Description                               |
| --------------- | ------------ | ----------------------------------------- |
| `fileReadTool`  | `file_read`  | Read file contents                        |
| `fileWriteTool` | `file_write` | Write file contents (creates parent dirs) |
| `shellTool`     | `shell`      | Run shell commands (30s timeout, 1MB buf) |

### Hand (File Manipulation)

Advanced file operations with safety features and undo support.

| Tool              | Name           | Description                                     |
| ----------------- | -------------- | ----------------------------------------------- |
| `fileMoveTool`    | `file_move`    | Move files with undo support                    |
| `fileCopyTool`    | `file_copy`    | Copy files                                      |
| `fileDeleteTool`  | `file_delete`  | Delete files (moves to trash, supports restore) |
| `fileGlobTool`    | `file_glob`    | Find files matching glob patterns               |
| `fileRestoreTool` | `file_restore` | List/restore files from trash                   |
| `fileBulkTool`    | `file_bulk`    | Execute batch file operations                   |

**Safety Features:**

- **Root Boundary:** All operations validate paths against a configurable root (default: project root) to prevent traversal attacks
- **Trash-Based Delete:** Deleted files move to `~/.null-agent/trash/` instead of permanent deletion
- **Glob Patterns:** `file_glob` supports `**/*.ts`, `src/**/*.js`, etc. with automatic `node_modules/`/`.git/` exclusion
- **Bulk Operations:** `file_bulk` executes batch move/copy/delete with partial failure handling

### Feet (Task Orchestration)

Script execution, process management, and terminal sessions.

| Tool                | Name             | Description                                    |
| ------------------- | ---------------- | ---------------------------------------------- |
| `scriptDetectTool`  | `script_detect`  | Auto-detect scripts from package.json/Makefile |
| `scriptRunTool`     | `script_run`     | Run detected or custom scripts                 |
| `processStartTool`  | `process_start`  | Start background processes                     |
| `processStopTool`   | `process_stop`   | Stop background processes                      |
| `processListTool`   | `process_list`   | List running processes                         |
| `sessionCreateTool` | `session_create` | Create persistent terminal sessions            |
| `sessionAttachTool` | `session_attach` | Attach to existing sessions                    |
| `taskSprintTool`    | `task_sprint`    | Run concurrent tasks with progress             |

**Process Features:**

- **Auto-Detection:** Automatically finds scripts from `package.json`, `Makefile`, and project conventions
- **Ephemeral Processes:** Background processes die when the agent stops
- **Streaming Modes:** Configure output as streamed, summarized, or both
- **Singleton Managers:** Shared ProcessManager/SessionManager across all tool instances

### Git Tools

| Tool               | Name             | Description    |
| ------------------ | ---------------- | -------------- |
| `gitStatusTool`    | `git_status`     | Git status     |
| `gitDiffTool`      | `git_diff`       | Git diff       |
| `gitLogTool`       | `git_log`        | Git log        |
| `gitBranchTool`    | `git_branch`     | Git branches   |
| `gitAddTool`       | `git_add`        | Git add        |
| `gitCommitTool`    | `git_commit`     | Git commit     |
| `gitShowTool`      | `git_show`       | Git show       |
| `gitPushTool`      | `git_push`       | Git push       |
| `gitPullTool`      | `git_pull`       | Git pull       |
| `gitFetchTool`     | `git_fetch`      | Git fetch      |
| `gitMergeTool`     | `git_merge`      | Git merge      |
| `gitRebaseTool`    | `git_rebase`     | Git rebase     |
| `gitStashPushTool` | `git_stash_push` | Git stash push |
| `gitStashPopTool`  | `git_stash_pop`  | Git stash pop  |
| `gitStashListTool` | `git_stash_list` | Git stash list |
| `gitStashDropTool` | `git_stash_drop` | Git stash drop |

### Dev Workflow Tools

| Tool                 | Name              | Description                          |
| -------------------- | ----------------- | ------------------------------------ |
| `changelogTool`      | `changelog`       | Generate changelog from commits      |
| `commitSmartTool`    | `commit_smart`    | Smart commit message suggestions     |
| `prCreateTool`       | `pr_create`       | Create GitHub PRs via `gh` CLI       |
| `prListTool`         | `pr_list`         | List open PRs                        |
| `issueCreateTool`    | `issue_create`    | Create GitHub issues                 |
| `issueListTool`      | `issue_list`      | List issues with filters             |
| `ciStatusTool`       | `ci_status`       | Check CI/CD status                   |
| `releasePrepareTool` | `release_prepare` | Prepare releases (version bump, tag) |

### Code Review Tools

| Tool         | Name          | Description                                         |
| ------------ | ------------- | --------------------------------------------------- |
| `reviewTool` | `code_review` | Comprehensive code review (security, perf, quality) |

### Testing Tools

| Tool               | Name                | Description                           |
| ------------------ | ------------------- | ------------------------------------- |
| `generateTestTool` | `generate_tests`    | Generate unit tests for source files  |
| `runTestTool`      | `run_tests`         | Run tests with detailed output        |
| `fixTestTool`      | `fix_tests`         | Analyze test failures, suggest fixes  |
| `coverageTool`     | `test_coverage`     | Analyze test coverage                 |
| `benchmarkTool`    | `benchmark`         | Performance benchmarking with P95/P99 |
| `aiTestTool`       | `ai_generate_tests` | AI-powered test generation            |

### Web Tools

| Tool            | Name         | Description                        |
| --------------- | ------------ | ---------------------------------- |
| `webSearchTool` | `web_search` | Search the web via Tavily API      |
| `webFetchTool`  | `web_fetch`  | Fetch URL content as readable text |

Get a free Tavily API key: https://tavily.com/

### Using Tools

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
    return { content: `Deployed to ${environment}` };
  },
});
```

## Interfaces

### Terminal UI

Full interactive terminal interface built with [Ink](https://github.com/vadimdemedes/ink). Features a status bar, chat panel with message bubbles, animated Null mascot (`◉◡`), slash commands, and formatted tool call display.

```
┌─────────────────────────────────┐
│ null-agent v0.1.0 · project     │  ← Status bar
├─────────────────────────────────┤
│                                 │
│  ▸ you                          │
│    Read the config file         │
│                                 │
│  ▸ assistant                    │
│  ┌─────────────────────────┐    │
│  │ ⚙ file_read              │    │
│  │ ✓ file_read → 12 lines  │    │
│  └─────────────────────────┘    │
│    The config contains...       │
│                                 │
├─────────────────────────────────┤
│ ◉◡ ready · /help                │  ← Agent bar (always visible)
├─────────────────────────────────┤
│ > _                             │  ← Input
└─────────────────────────────────┘
```

```bash
null-agent
```

**Slash Commands:**

| Command               | Description                |
| --------------------- | -------------------------- |
| `/help`               | Show keyboard shortcuts    |
| `/clear`              | Clear conversation history |
| `/context`            | Show project context       |
| `/history`            | List past conversations    |
| `/search <query>`     | Search past conversations  |
| `/resume <id>`        | Resume a past conversation |
| `/tasks`              | Show tracked tasks         |
| `/done <id>`          | Mark a task complete       |
| `/config`             | Show personality config    |
| `/config tone casual` | Change tone setting        |
| `/model`              | Show current model         |
| `/model <name>`       | Change model               |
| `/models`             | List available models      |
| `/exit`               | Exit                       |

### Readline REPL

Lightweight readline-based REPL with colored output. No extra dependencies.

```bash
null-agent --plain
```

### HTTP API Server

REST API server with streaming SSE support. Default port 3737. Zero dependencies (uses Node.js built-in `http`).

```bash
null-agent --server --port 3737 --host 0.0.0.0
```

**Endpoints:**

| Method   | Path                    | Description                   |
| -------- | ----------------------- | ----------------------------- |
| `POST`   | `/chat`                 | Send a message, get response  |
| `POST`   | `/chat/stream`          | Stream response via SSE       |
| `GET`    | `/history`              | Get conversation history      |
| `DELETE` | `/history`              | Clear conversation history    |
| `GET`    | `/conversations`        | List saved conversations      |
| `GET`    | `/conversations/search` | Search conversations by query |
| `POST`   | `/conversations/resume` | Resume a conversation         |
| `GET`    | `/tasks`                | List tasks                    |
| `POST`   | `/tasks`                | Add a task                    |
| `POST`   | `/tasks/:id/done`       | Complete a task               |
| `GET`    | `/config`               | Get configuration             |
| `PATCH`  | `/config`               | Update configuration          |
| `GET`    | `/health`               | Health check                  |

### One-Shot CLI

Send a single message and print the response. Good for scripting.

```bash
null-agent "what does this function do?"
null-agent --provider openai "summarize the changes"
null-agent --provider gemini --model gemini-3.1-flash "explain git rebase"
```

## Configuration

### Personality

Control the agent's tone, verbosity, and proactivity:

```ts
import { loadConfig, saveConfig } from "null-agent";

const config = await loadConfig();
config.personality = {
  tone: "casual", // "professional" | "casual" | "concise"
  verbosity: "balanced", // "minimal" | "balanced" | "detailed"
  proactivity: "active", // "passive" | "balanced" | "active"
};
await saveConfig(config);
```

Or via CLI:

```bash
null-agent config
null-agent config tone casual
null-agent config verbosity minimal
null-agent config proactivity active
```

Config is persisted at `~/.null-agent/config.json`.

### Unified Config

Layered config loading with priority: defaults < env vars < `~/.null-agent/config.json` < `.null-agent.json` in project root.

```ts
import { loadUnifiedConfig } from "null-agent";

const config = await loadUnifiedConfig("./my-project");
// config.provider, config.personality, config.permissions, etc.
```

### Project Config

Create `.null-agent.json` in your project root for project-specific settings:

```json
{
  "personality": {
    "tone": "professional",
    "verbosity": "detailed"
  },
  "permissions": {
    "mode": "confirm",
    "allowWrite": true,
    "denyPatterns": ["rm -rf"]
  }
}
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
console.log(knowledge.conventions); // { typescript: true, testFramework: "vitest" }
```

Detects: Next.js, Nuxt, React, Vue, Express, Fastify, Hono, NestJS, and more.

## Awareness

Real-time git monitoring and file watching:

```ts
import { AwarenessManager } from "null-agent";

const awareness = new AwarenessManager({ projectDir: "./my-project" });
awareness.start({
  onEvent: (event) => {
    console.log(`${event.type}: ${event.message}`);
  },
});
```

**Events:**

| Event          | Trigger                   |
| -------------- | ------------------------- |
| `git:change`   | New staged/modified files |
| `git:branch`   | Branch switch detected    |
| `git:conflict` | Merge conflicts found     |
| `file:create`  | New files created         |
| `file:modify`  | Files modified            |
| `file:delete`  | Files deleted             |

## Task Tracking

Tasks are automatically extracted from conversations:

```ts
import { Agent } from "null-agent";

const agent = new Agent({ provider, tools });
await agent.chat("We need to refactor the auth module");

// Tasks are auto-extracted
const tasks = agent.getOpenTasks();

// Manual task management
agent.addTask("Write unit tests for auth");
agent.completeTask("task-id");
```

## Multi-Agent Orchestration

The agent can spawn parallel sub-agents for complex tasks:

```ts
import { Agent, createProvider, createDefaultRegistry } from "null-agent";

const agent = new Agent({
  provider: createProvider("anthropic"),
  tools: createDefaultRegistry(),
  enableOrchestrator: true,
});

// The agent can use the "spawn_task" tool to delegate work
const result = await agent.chat("Investigate these 3 files in parallel");
```

Safety limits: 5 concurrent sub-agents, 3 spawns per turn, 30s timeout per sub-agent.

## Agent Events

The agent emits rich events for streaming UIs and monitoring:

```ts
import { Agent } from "null-agent";

const agent = new Agent({
  provider,
  tools,
  eventHandlers: {
    onAgentStart: (data) => console.log("Started:", data.message),
    onTurnStart: (data) => console.log("Turn:", data.turn),
    onMessageUpdate: (data) => console.log("Text:", data.delta),
    onToolExecutionStart: (data) => console.log("Running:", data.name),
    onToolExecutionEnd: (data) => console.log("Done:", data.name, data.isError),
    onAgentEnd: (data) => console.log("Complete in", data.iterations, "iterations"),
  },
});

await agent.chat("Hello");
```

**Events:**

| Event                   | Description              |
| ----------------------- | ------------------------ |
| `onAgentStart`          | Agent begins processing  |
| `onTurnStart`           | New turn begins          |
| `onMessageStart`        | Assistant message starts |
| `onMessageUpdate`       | Text chunk received      |
| `onMessageEnd`          | Message complete         |
| `onToolExecutionStart`  | Tool call starts         |
| `onToolExecutionUpdate` | Tool streaming result    |
| `onToolExecutionEnd`    | Tool execution complete  |
| `onToolResult`          | Tool result ready        |
| `onAgentEnd`            | Agent finished           |

## Tool Hooks

Intercept and control tool execution:

```ts
const agent = new Agent({
  provider,
  tools,
  toolHooks: {
    beforeToolCall: async (context) => {
      console.log("About to run:", context.name);
      // Return false to block execution
    },
    afterToolCall: async (context) => {
      console.log("Finished:", context.name, context.result);
    },
  },
});
```

## Steering

Inject messages or queue work during/after agent runs:

```ts
const agent = new Agent({ provider, tools });

// Inject context before next chat
agent.steer({ role: "user", content: "Remember: use TypeScript" });
await agent.chat("Hello");

// Queue work after agent stops
agent.followUp(async () => {
  await agent.chat("Now summarize what we did");
});
```

## TypeBox Tool Schemas

Tools can use TypeBox for type-safe parameter validation:

```ts
import { toolParams, String, Object } from "null-agent";

const tool = {
  name: "my_tool",
  description: "Does something",
  parameters: {
    /* JSON Schema */
  },
  typeboxSchema: toolParams(
    {
      name: String({ description: "The name" }),
      options: Object(
        {
          properties: { verbose: String() },
        },
        ["verbose"],
      ),
    },
    ["name"],
  ),
  async execute(params) {
    // params are validated
  },
};
```

## Code Review

Comprehensive code review with pattern-based analysis:

```ts
import { reviewCode, formatReviewReport } from "null-agent";

const result = await reviewCode({ diff: true });
console.log(formatReviewReport(result));
```

**Review Categories:**

- **Security** — SQL injection, XSS, hardcoded secrets, weak crypto
- **Performance** — N+1 queries, sync ops, missing indexes, chained arrays
- **Quality** — Long functions, deep nesting, magic numbers, empty catch blocks
- **Testing** — Missing test files detection
- **Best Practices** — Error handling, TypeScript typing

**Scoring:** 0-100 per category with weighted overall score.

## Automated Testing

Generate, run, and fix tests automatically:

```ts
import { generateTests, runTests, analyzeTestFailures, benchmark } from "null-agent";

// Generate tests for a file
const testFile = await generateTests("./src/auth.ts");
await writeTestFile(testFile);

// Run tests
const results = await runTests();

// Benchmark a function
const result = await benchmark(() => myFunction(), { iterations: 100 });
```

## Plugin System

Extend null-agent with custom plugins:

```ts
import { PluginManager, EventBus } from "null-agent";

const bus = new EventBus();
const manager = new PluginManager(bus, process.cwd());

await manager.register({
  name: "my-plugin",
  version: "1.0.0",
  setup(context) {
    context.registerTool({
      name: "my_tool",
      description: "Does something useful",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ content: "done" }),
    });
    context.bus.on("agent:text", (event) => {
      console.log("Agent said:", event.data);
    });
  },
});
```

## Event Bus

Decoupled communication between modules:

```ts
import { EventBus, Events } from "null-agent";

const bus = new EventBus();

bus.on(Events.TOOL_AFTER, (event) => {
  console.log(`Tool ${event.data.name} completed`);
});

bus.on(Events.AGENT_DONE, (event) => {
  console.log("Agent finished:", event.data);
});
```

## Permission System

Control what the agent can do:

```ts
import { PermissionManager } from "null-agent";

const permissions = new PermissionManager({
  mode: "confirm", // "auto" | "confirm" | "plan"
  allowWrite: true,
  allowShell: true,
  allowGit: true,
  denyPatterns: ["rm -rf", "sudo"],
});
```

**Modes:**

- `auto` — execute everything
- `confirm` — ask before destructive operations
- `plan` — read-only mode

## CI/CD Integration

Generate CI/CD configs for automated code review:

```ts
import { setupCI, generateGitHubAction, generatePreCommitHook } from "null-agent";

// Setup CI for a project
await setupCI({
  platform: "github",
  reviewOnPR: true,
  failOnCritical: true,
  minScore: 70,
});
```

## Session Export

Export conversations in multiple formats:

```ts
import { exportToFile } from "null-agent";

await exportToFile(conversation, {
  format: "markdown", // or "json", "html"
  outputPath: "./exports",
});
```

## Architecture

```
src/
  providers/       LLM provider abstraction (OpenAI, Anthropic, Gemini, OpenRouter)
  tools/           Tool system (file, shell, git, workflow, review, testing)
  agent/           Agent loop, orchestrator, tasks, suggestions, personality
  cli/             CLI entry point, REPL, output formatting
  tui/             Ink terminal UI (StatusBar, ChatPanel, InputBar, NullFace)
  server/          HTTP API server with SSE streaming
  memory/          Conversation persistence, session export
  context/         Project knowledge scanning, context window management
  awareness/       Git monitoring, file watching
  bus/             Event bus for decoupled communication
  config/          Unified config system
  permission/      Permission management
  plugin/          Plugin architecture
  command/         Command pattern with undo support
  auth/            API key management
  review/          Code review system (security, perf, quality, CI)
  testing/         Test generation, execution, benchmarking
```

## CLI Reference

```
null-agent - Interactive coding assistant

Usage:
  null-agent                  Start interactive TUI
  null-agent "your message"   One-shot mode
  null-agent --plain          Start plain readline REPL
  null-agent --server         Start HTTP API server
  null-agent auth             Configure API keys interactively
  null-agent auth status      Show API key status
  null-agent auth <provider>  Configure one provider
  null-agent --help           Show this help

Options:
  --provider <name>   LLM provider (openai, anthropic, gemini, openrouter)
  --model <name>      Model name
  --plain             Use plain readline instead of TUI
  --server            Start HTTP API server
  --port <number>     Server port (default: 3737)
  --host <address>    Server host (default: 127.0.0.1)

Environment:
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
  GEMINI_API_KEY      Google Gemini API key (free tier available)
  OPENROUTER_API_KEY  OpenRouter API key (free models available)
```

## License

MIT
