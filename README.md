# null-agent

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.19-brightgreen?style=for-the-badge&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/typescript-6.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tests-255%2F255%20passing-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/tools-49%20built--in-orange?style=for-the-badge" alt="Tools" />
  <img src="https://img.shields.io/badge/providers-5%20LLMs-purple?style=for-the-badge" alt="Providers" />
  <img src="https://img.shields.io/badge/build-passing-success?style=for-the-badge&logo=vite" alt="Build" />
</p>

Interactive coding assistant library with multi-provider LLM support, a rich terminal UI, tool system, conversation memory, project awareness, multi-agent orchestration, and a built-in **developer day tracker** that keeps you accountable.

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
3. `~/.null-agent/credentials.json` file fallback

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

## Accountability & Developer Day Tracker

null-agent includes a self-aware developer day companion that tracks what you are working on, keeps you accountable to your goals, and generates daily and weekly reports — all without leaving the terminal.

### How it works

Activity is tracked in two ways:

- **Inferred** — every tool call is mapped to an activity type automatically. Reading files → `coding`. Running tests → `testing`. `git diff` → `review`. Shell commands are classified by regex (e.g. `jest` → `testing`, `inspect` → `debugging`).
- **Explicit** — use `/track <type>` to manually declare what you are working on.

Activity data is written to `~/.null-agent/accountability/activities/{date}.json` and is never sent anywhere.

### Activity Types

| Type        | Icon | Inferred from                                                              |
| ----------- | ---- | -------------------------------------------------------------------------- |
| `coding`    | ⌨    | `file_read`, `file_write`, `git_add`, `git_commit`, `shell` (build/deploy) |
| `review`    | 👁   | `git_diff`, `git_log`, `git_show`, `code_review`                           |
| `debugging` | 🔍   | Shell commands containing `debug`/`inspect`/`log`                          |
| `testing`   | ✓    | Shell commands containing `test`/`jest`/`vitest`                           |
| `docs`      | 📝   | Explicitly tracked                                                         |
| `meeting`   | 📅   | Calendar events (via Google Calendar integration)                          |
| `planning`  | —    | `git_branch`, `task_sprint`                                                |
| `standup`   | —    | Explicitly tracked                                                         |
| `break`     | 💤   | No activity detected for 30+ minutes                                       |

### Face Mood by Activity

The Null mascot (`◉`) changes expression based on what you are doing:

| Activity  | Face   | Mood      |
| --------- | ------ | --------- |
| coding    | `◉◡⟳`  | Executing |
| review    | `◉◡~`  | Thinking  |
| debugging | `◉◡/`  | Confused  |
| testing   | `◉◡\|` | Loading   |
| meeting   | `◉◡.`  | Waiting   |
| break     | `◉◡z`  | Sleeping  |

### Status Bar

The status bar shows the current activity and live duration:

```
╭─────────────────────────────────────────────────────────────────╮
│ null-agent  v0.5.0  · my-project (main) ●   ⌨ coding  1h 23m  │
╰─────────────────────────────────────────────────────────────────╯
```

### Daily Summary on Startup

On launch, a panel shows today's meetings, goals, and yesterday's time breakdown:

```
╭──────────────────────────────────────────────────────────────────╮
│ Good morning! Here's your day:                                    │
│                                                                   │
│ Meetings:                                                         │
│   · 9:00 AM: Daily standup (15m)                                  │
│   · 2:00 PM: Product sync (1h)                                    │
│                                                                   │
│ Goals:                                                            │
│   · Complete auth refactor                                        │
│   · Review 2 PRs                                                  │
│                                                                   │
│ Yesterday:                                                        │
│   5h coding, 1h 30m meetings, 45m debugging                       │
│                                                                   │
│ Ctrl+S to dismiss · /report for full report                       │
╰──────────────────────────────────────────────────────────────────╯
```

Press `Ctrl+S` to toggle the summary.

### Goal Tracking

```bash
/goals               # List today's goals with status icons
/goal add <text>     # Create a new daily goal
/goal done <id>      # Mark a goal complete (triggers celebration)
/goal rm <id>        # Delete a goal
```

Goal statuses: `○ pending` · `⟳ in-progress` · `✓ completed` · `✗ missed`

### Activity Commands

```bash
/track coding        # Start tracking an explicit coding session
/track meeting       # Log a meeting
/track break         # Log a break
/track stop          # Stop the current tracked activity
```

Valid types: `coding`, `review`, `debugging`, `testing`, `docs`, `meeting`, `planning`, `standup`, `break`, `other`

### Reports

```bash
/report              # Generate today's report (saved to disk)
/report week         # Generate this week's report
```

**Daily report format:**

```markdown
# Daily Report — April 11, 2026

## Summary

- **Active time:** 6h 45m
- **Activities:** 12
- **Commits:** 3
- **Code reviews:** 2

## Time Breakdown

| Activity  | Time   | %   |
| --------- | ------ | --- |
| Coding    | 3h 20m | 49% |
| Meetings  | 1h 30m | 22% |
| Reviews   | 45m    | 11% |
| Debugging | 30m    | 7%  |
| Testing   | 20m    | 5%  |
| Other     | 20m    | 6%  |

## Activities

- 9:00 AM - 9:15 AM: Morning standup (15m)
- 9:15 AM - 10:30 AM: Feature implementation — auth module (1h 15m)
  ...

## Goals

- [x] Complete auth module refactor
- [ ] Review PR #42
```

Reports are saved to `~/.null-agent/accountability/reports/daily/YYYY-MM-DD.{md,json}` and `reports/weekly/YYYY-wNN.md`.

### Proactive Reminders

The accountability engine polls every minute and surfaces messages in the chat when:

- A goal has been pending all day with no progress (`goal:reminder`)
- A goal is past its due date (`goal:overdue`)
- You have been coding or debugging for 2+ hours (`time:threshold` — break reminder)
- A debugging session exceeds 1 hour (`time:milestone` — ask for help?)
- It is 9–10 AM and you have not checked in (`daily:start`)
- It is 5–6 PM and the day is ending (`daily:end`)

### Using Accountability as a Library

```ts
import {
  ActivityTracker,
  Reporter,
  Accountant,
  GoalTracker,
  AccountabilityStore,
  AccountabilityConfigManager,
} from "null-agent";

const store = new AccountabilityStore();
const tracker = new ActivityTracker();
await tracker.init();

// Explicit tracking
const activityId = await tracker.startActivity("coding", "Auth module refactor");
await tracker.endActivity(activityId);

// Inferred tracking — call this in your tool hook
await tracker.recordToolCall("file_write", { path: "src/auth.ts" }, "ok");

// Session stats (real-time)
const stats = tracker.getSessionStats();
console.log(`Coding: ${stats.timeByType.coding}s`);

// Daily report
const reporter = new Reporter(store, tracker);
const report = await reporter.generateDailyReport();
console.log(reporter.formatDailyReport(report));
await reporter.saveReport(report); // writes .md and .json to disk

// Weekly report
const monday = new Date(); // normalized to Monday
const weekly = await reporter.generateWeeklyReport(monday);
console.log(reporter.formatWeeklyReport(weekly));

// Goals
const goals = new GoalTracker(store);
const goal = await goals.createGoal("Ship the auth feature", "daily");
await goals.updateGoalProgress(goal.id, activityId);
await goals.completeGoal(goal.id);

// Accountant notifications
const accountant = new Accountant(tracker);
const notifications = await accountant.checkGoalProgress();
for (const n of notifications) {
  console.log(`[${n.priority}] ${n.message}`);
}

// Config
const config = new AccountabilityConfigManager(store);
await config.load();
await config.setTrackingMode("explicit");
await config.setBreakThreshold(90); // remind after 90 min
```

### Integrations (Phase 4 — Stubs)

Google Calendar, Jira, and Linear integration stubs are included and ready to be wired up with credentials.

```ts
import { GoogleCalendarIntegration, JiraIntegration, LinearIntegration } from "null-agent";

// Google Calendar — requires OAuth 2.0 (run: null-agent auth google)
const calendar = new GoogleCalendarIntegration();
calendar.configure({ accessToken: "...", refreshToken: "...", expiresAt: Date.now() + 3600_000 });
const todayEvents = await calendar.getEvents(new Date());
calendar.watchCalendar((events) => console.log("Upcoming:", events), 5);

// Jira
const jira = new JiraIntegration();
await jira.configure({
  type: "jira",
  apiKey: "...",
  baseUrl: "https://my.atlassian.net",
  projectKey: "ENG",
});
const myTasks = await jira.getMyTasks(); // returns TaskItem[]

// Linear
const linear = new LinearIntegration();
await linear.configure({ type: "linear", apiKey: "...", teamId: "..." });
```

### Storage Layout

```
~/.null-agent/accountability/
├── activities/
│   ├── 2026-04-10.json     ← daily activity log
│   └── 2026-04-11.json
├── reports/
│   ├── daily/
│   │   ├── 2026-04-10.json ← machine-readable
│   │   └── 2026-04-10.md   ← human-readable Markdown
│   └── weekly/
│       └── 2026-w15.md
├── goals/
│   └── goals.json
└── config.json             ← tracking preferences
```

---

## Interfaces

### Terminal UI

Full interactive terminal interface built with [Ink](https://github.com/vadimdemedes/ink). Features a status bar with live activity tracking, chat panel with message bubbles, animated Null mascot (`◉`), slash commands, formatted tool call display, and a daily summary panel.

```
╭─────────────────────────────────────────────────────╮
│ null-agent v0.5.0 · project (main) ●  ⌨ coding 23m │  ← Status bar
╰─────────────────────────────────────────────────────╯
╭─────────────────────────────────────────────────────╮
│ Good morning! Here's your day:                       │  ← Daily summary (Ctrl+S)
│   Goals: · Ship auth feature  · Review 2 PRs         │
│   Yesterday: 5h coding, 2h meetings                  │
╰─────────────────────────────────────────────────────╯
  ▸ you
    Read the config file

  ▸ assistant
  ┌─────────────────────────────┐
  │ ⚙ file_read                 │
  │ ✓ file_read → 12 lines      │
  └─────────────────────────────┘
    The config contains...

◉◡ ready · /help                                        ← Agent bar
> _                                                     ← Input
```

```bash
null-agent
```

### Slash Commands

| Command               | Description                         |
| --------------------- | ----------------------------------- |
| `/help`               | Show keyboard shortcuts             |
| `/clear`              | Clear conversation history          |
| `/context`            | Show project context                |
| `/history`            | List past conversations             |
| `/search <query>`     | Search past conversations           |
| `/resume <id>`        | Resume a past conversation          |
| `/tasks`              | Show tracked tasks                  |
| `/done <id>`          | Mark a task complete                |
| `/config`             | Show personality config             |
| `/config tone casual` | Change tone setting                 |
| `/model`              | Show current model                  |
| `/model <name>`       | Change model                        |
| `/models`             | List available models               |
| `/report`             | Generate today's activity report    |
| `/report week`        | Generate this week's report         |
| `/goals`              | List today's goals                  |
| `/goal add <text>`    | Add a daily goal                    |
| `/goal done <id>`     | Mark a goal complete                |
| `/goal rm <id>`       | Delete a goal                       |
| `/track <type>`       | Start tracking an explicit activity |
| `/track stop`         | Stop the current activity           |
| `/exit`               | Exit                                |

**Keyboard shortcuts:**

| Key       | Action                     |
| --------- | -------------------------- |
| `Ctrl+C`  | Exit                       |
| `Ctrl+H`  | Toggle help overlay        |
| `Ctrl+S`  | Toggle daily summary panel |
| `↑` / `↓` | Navigate input history     |

### Readline REPL

Lightweight readline-based REPL with colored output. No extra dependencies.

```bash
null-agent --plain
```

### HTTP API Server

REST API server with streaming SSE support. Default port 3737.

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

Or via CLI slash commands in the TUI:

```
/config tone casual
/config verbosity minimal
/config proactivity active
```

Config is persisted at `~/.null-agent/config.json`.

### Tracking Preferences

```ts
import { AccountabilityConfigManager, AccountabilityStore } from "null-agent";

const config = new AccountabilityConfigManager(new AccountabilityStore());
await config.load();

await config.setTrackingMode("hybrid"); // "hybrid" | "explicit" | "implicit"
await config.setBreakThreshold(90); // minutes before break reminder
await config.toggleBreakReminders(true);
await config.toggleMeetingReminders(true);
await config.toggleGoalReminders(false);
```

Default config:

```json
{
  "tracking": {
    "mode": "hybrid",
    "autoInfer": true,
    "idleThresholdMinutes": 30,
    "activityGroupingMinutes": 5
  },
  "reminders": {
    "upcomingMeetings": true,
    "meetingReminderMinutes": 5,
    "breakReminders": true,
    "breakThresholdMinutes": 120,
    "dailyStartSummary": true,
    "dailyEndSummary": true,
    "goalReminders": true
  }
}
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
      options: Object({ properties: { verbose: String() } }, ["verbose"]),
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

const testFile = await generateTests("./src/auth.ts");
const results = await runTests();
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

## Architecture

```
src/
  providers/          LLM provider abstraction (OpenAI, Anthropic, Gemini, OpenRouter)
  tools/              Tool system (file, shell, git, workflow, review, testing, web)
  agent/              Agent loop, orchestrator, tasks, suggestions, personality
  cli/                CLI entry point, REPL, output formatting
  tui/                Ink terminal UI
    app.tsx             Root component with slash commands, accountability wiring
    components/
      StatusBar.tsx     Live activity type + duration display
      AgentBar.tsx      Mascot, status text, open task count
      DailySummary.tsx  Startup panel: goals, meetings, yesterday's summary
      ChatPanel.tsx     Message thread with tool call display
      HelpOverlay.tsx   Keyboard shortcuts and command reference
      NullFace.tsx      Animated mascot with 11 moods + activity-based mood
      Notification.tsx  File/git event toasts
      InputBar.tsx      Input with history navigation
  server/             HTTP API server with SSE streaming
  memory/             Conversation persistence, session export
  context/            Project knowledge scanning, context window management
  awareness/          Git monitoring, file watching
  accountability/     Developer day tracker
    types.ts            Activity, Goal, DayReport, WeeklyReport, SessionStats interfaces
    tracker.ts          ActivityTracker: explicit + inferred tracking, goals
    inferencer.ts       Tool → activity type mapping, shell command heuristics
    reporter.ts         Daily/weekly report generation, Markdown/CSV/JSON export
    accountant.ts       Proactive reminders, goal accountability, break suggestions
    storage.ts          JSON persistence in ~/.null-agent/accountability/
    goals.ts            GoalTracker: create, complete, miss, filter, format
    config.ts           AccountabilityConfigManager: typed settings API
    integrations/
      calendar.ts       Google Calendar stub (OAuth + polling)
      tasks.ts          Jira + Linear stubs
  bus/                Event bus for decoupled communication
  config/             Unified config system
  permission/         Permission management
  plugin/             Plugin architecture
  command/            Command pattern with undo support
  auth/               API key management (keychain + file fallback)
  review/             Code review system (security, perf, quality, CI)
  testing/            Test generation, execution, benchmarking
  feet/               Process + session manager singletons
```

## CLI Reference

```
null-agent — Interactive coding assistant

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
  TAVILY_API_KEY      Tavily search API key (free tier available)
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a full history of changes by version.

## License

MIT
