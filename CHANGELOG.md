# Changelog

All notable changes to null-agent are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.5.0] — 2026-04-11

### Added

**Accountability & Developer Day Tracker — Phase 3: Goals + Config + Integrations**

- `src/accountability/goals.ts` — `GoalTracker` class: create, complete, miss, delete, and filter goals by type, status, or due date. Supports `daily`, `weekly`, and `sprint` goal types. Short-ID formatting in goal lists
- `src/accountability/config.ts` — `AccountabilityConfigManager` class: load, save, and update tracking preferences and reminder settings through a typed API instead of direct store calls
- `src/accountability/integrations/calendar.ts` — `GoogleCalendarIntegration` stub: OAuth 2.0 setup docs, event caching, `watchCalendar()` polling loop, `getUpcomingEvents()`, `injectEvents()` for testing. Full API calls wired in Phase 4
- `src/accountability/integrations/tasks.ts` — `JiraIntegration` and `LinearIntegration` stubs with `TaskBoardIntegration` interface, `TaskItem` / `TaskStatus` / `TaskPriority` types, and commented API call locations
- `src/accountability/integrations/index.ts` — barrel export for all integrations
- `src/accountability/types.ts` — `WeeklyReport` interface

**Weekly Reports**

- `Reporter.generateWeeklyReport(weekStart)` — aggregates 7 daily reports into a `WeeklyReport`
- `Reporter.formatWeeklyReport(report)` — Markdown table with day-by-day and aggregate breakdown
- `Reporter.saveReport(report)` — persists both `.json` and `.md` files to `~/.null-agent/accountability/reports/daily/`
- `Reporter.saveWeeklyReport(report)` — persists to `~/.null-agent/accountability/reports/weekly/` with ISO week label (e.g. `2026-w15.md`)

**TUI: 7 new slash commands**

| Command            | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `/report`          | Generate and display today's full activity report                           |
| `/report week`     | Generate and display this week's report                                     |
| `/goals`           | List today's goals with status icons                                        |
| `/goal add <text>` | Create a new daily goal                                                     |
| `/goal done <id>`  | Complete a goal (triggers celebration message)                              |
| `/goal rm <id>`    | Delete a goal                                                               |
| `/track <type>`    | Start tracking an explicit activity (`coding`, `review`, `debugging`, etc.) |
| `/track stop`      | Stop the current tracked activity                                           |

**TUI: Activity-based face mood**

- `getMoodForActivity(type)` in `NullFace.tsx` — maps current activity type to face mood when the agent is idle: `coding→executing`, `review/docs/planning→thinking`, `debugging→confused`, `testing→loading`, `meeting/standup→waiting`, `break→sleeping`
- `app.tsx` now uses activity-based mood when idle instead of always returning `idle`

**TUI: Enhanced Daily Summary**

- `DailySummary.tsx` redesigned to match spec: shows **Meetings**, **Goals**, and **Yesterday's summary** on startup
- Accepts `goals`, `calendarEvents`, and `yesterdaySummary` props
- Falls back to current session stats when no calendar/goals data is present

**TUI: Startup data loading**

- `app.tsx` loads today's goals and yesterday's activity summary on init
- Accountant polling loop (every 60s) checks goal progress, activity patterns, and daily rituals — surfaces notifications as system messages

**Bug fixes**

- `tracker.recordToolCall` was passing `{}` for tool arguments; now caches args from `onToolCall` and passes them through to `onToolResult`
- `tracker.resumeActivity` now properly clears `endTime`/`duration` so the activity becomes active again; previously it returned early if `endTime` was set (making resume a no-op after pause)
- `tracker.recordToolCall` now respects `mode: "explicit"` and returns early; previously only `autoInfer: false` blocked inference

**Storage improvements**

- `AccountabilityStore` now accepts an optional `baseDir` constructor argument for test isolation
- `saveDailyReport` now writes both `.json` and `.md` files; the markdown path was defined but never written previously
- Added `saveWeeklyReport(weekLabel, markdown)` method

**Test coverage — 64 new tests (255 total)**

- `tests/accountability/tracker.test.ts` — 17 tests: explicit tracking, pause/resume, inferred tracking, mode enforcement, activity summary, session stats, goals
- `tests/accountability/reporter.test.ts` — 14 tests: daily report structure, markdown formatting (goals, checkboxes), CSV/JSON export, `saveReport` disk write, weekly report generation and aggregation
- `tests/accountability/accountant.test.ts` — 12 tests: goal progress notifications, overdue goal detection, break/debug time thresholds, daily rituals, challenge/celebrate/suggest-break messages, daily summary
- `tests/accountability/goals.test.ts` — 21 tests: creation and persistence, status updates, deduplication of activity links, filtering by today/due date/status, deletion, formatting

**Exports**

- `WeeklyReport` type
- `AccountabilityConfigManager`
- `GoalTracker`
- `GoogleCalendarIntegration`, `JiraIntegration`, `LinearIntegration`
- `TaskItem`, `TaskBoardConfig`, `TaskBoardIntegration`, `TaskStatus`, `TaskPriority`, `GoogleCalendarTokens`

---

## [0.4.0] — 2026-04-10

### Added

**Accountability & Developer Day Tracker — Phase 1: Core tracking**

- `src/accountability/types.ts` — `Activity`, `ActivityType`, `ActivitySummary`, `Goal`, `DayReport`, `CalendarEvent`, `SessionStats`, `AccountabilityConfig`, `DEFAULT_CONFIG`
- `src/accountability/tracker.ts` — `ActivityTracker`: start/end/pause/resume explicit activities, `recordToolCall` for inferred tracking, `getActivitySummary`, `getSessionStats`, goal CRUD
- `src/accountability/inferencer.ts` — `ActivityInferencer`: `TOOL_ACTIVITY_MAP` for all built-in tools, `inferShellActivity` with regex heuristics for test/debug/build/deploy, `shouldGroupActivity` (5-minute window), `detectIdle` (configurable threshold)
- `src/accountability/storage.ts` — `AccountabilityStore`: daily activity logs in `~/.null-agent/accountability/activities/{date}.json`, goals in `goals/goals.json`, reports in `reports/daily/` and `reports/weekly/`, config in `config.json`
- `src/accountability/reporter.ts` — `Reporter`: `generateDailyReport`, `formatDailyReport` (Markdown table), `exportToCSV`, `exportToJSON`, `formatSessionStats`
- `src/accountability/accountant.ts` — `Accountant`: `checkUpcomingMeetings`, `checkGoalProgress`, `checkActivityPatterns`, `checkDailyRituals`, `challengeUser`, `celebrateWin`, `suggestBreak`, `getDailySummary`; cooldown system for notification deduplication
- `tests/accountability.test.ts` — 9 tests for `ActivityInferencer`

**Accountability & Developer Day Tracker — Phase 2: TUI integration**

- `src/tui/components/StatusBar.tsx` — now shows current activity type (with icon: ⌨ ⁰ 👁 🔍 ✓ 📅 📝) and live duration
- `src/tui/components/DailySummary.tsx` — initial version with session duration, activity count, and time-by-type breakdown; `Ctrl+S` to toggle
- `app.tsx` — `ActivityTracker` wired in; `recordToolCall` called on every `onToolResult`; `sessionStats` updated every minute; `DailySummary` rendered on startup

### Fixed

- Agent was receiving empty strings as tool results due to a wiring mismatch in `loop.ts` — tool results are now correctly passed through (`bc13182`)
- TypeBox `Object` naming conflict with JavaScript global `Number`/`Object` resolved (`b50cdb9`)
- `file_glob` TypeBox schema had invalid array argument and missing property descriptions (`fa11c8d`, `ab3a3bc`)
- Shell output truncated to first line — now shows full output up to 15 entries with `+N more` overflow (`e0ff998`, `1fc1658`)
- Tool result limit increased from 5k to 15k characters to reduce context truncation (`cb52fcb`)

---

## [0.4.0-pre] — 2026-04-09

### Added

**TUI overhaul** (`b60f766`)

- Animated `◉` Null mascot with 11 moods (`idle`, `thinking`, `executing`, `happy`, `waiting`, `sleeping`, `excited`, `confused`, `error`, `success`, `loading`), 8-frame animation at 500ms
- `AgentBar` component — always-visible bottom bar with mascot, status text, open task count
- `HelpOverlay` — full keyboard shortcut and command reference via `Ctrl+H`
- Input history navigation with `↑`/`↓`
- `Ctrl+S` shortcut wired up (used later for daily summary)
- Idle activity system — tips and encouragement shown after inactivity

**Version bump to 0.4.0** (`9491fab`)

---

## [0.2.2] — 2026-04-05

### Added

- Shields.io badges in README (`170e17a`)

### Fixed

- Version number alignment in `package.json` (`0a8aed6`)

---

## [0.2.1] — 2026-04-05

### Fixed

- Version metadata update (`79df251`)

---

## [0.2.0] — 2026-04-05

### Added

**Dev workflow tools** (`da6fbb9`)

- `changelog` — generate changelog from git commits
- `commit_smart` — AI-powered commit message suggestions
- `pr_create` / `pr_list` — create and list GitHub PRs via `gh` CLI
- `issue_create` / `issue_list` — create and list GitHub issues with filters
- `ci_status` — check CI/CD pipeline status
- `release_prepare` — version bump, tag, and release prep

**AI code review system** (`880dd9e`, `ba63c1f`, `cc36f73`)

- `code_review` tool — comprehensive analysis across security, performance, quality, testing, and best practices
- Pattern library: SQL injection, XSS, hardcoded secrets, weak crypto, N+1 queries, sync ops, long functions, deep nesting, magic numbers, empty catch blocks
- Scoring: 0–100 per category with weighted overall score
- CI/CD integration: GitHub Actions and pre-commit hook generation

**Automated testing tools** (`3241d34`, `cc36f73`)

- `generate_tests` — generate unit test files for source files
- `run_tests` — execute tests with detailed output
- `fix_tests` — analyze test failures and suggest fixes
- `test_coverage` — analyze coverage gaps
- `benchmark` — performance benchmarking with P50/P95/P99 percentiles
- `ai_generate_tests` — AI-powered test generation

**Context management** (`ba60df4`)

- `ContextManager` — token-aware context window with model-specific limits
- Message truncation strategy preserving system prompt and recent messages
- Session export in Markdown, JSON, and HTML formats

**Conversational improvements** (`04528df`)

- Personality config: `tone`, `verbosity`, `proactivity`
- Layered config loading: defaults → env → `~/.null-agent/config.json` → `.null-agent.json`
- Proactive suggestions after tool usage

### Fixed

- Plain REPL fallback when TUI dependencies are missing (`73b1482`)

---

## [0.1.1] — 2026-04-03

### Fixed

- Package name updated to `null-agent` in `package.json` (`8ecac6a`)
- `script_detect` test now uses temp directory to avoid cwd pollution (`f25d164`)

---

## [0.1.0] — 2026-04-03

### Added

**Feet module — script execution and process management** (`7eebf7a`, `59227a0`)

- `script_detect` — auto-detect scripts from `package.json`, `Makefile`, `Taskfile`, and project conventions
- `script_run` — run detected or custom scripts with configurable output modes (streamed, summarized, both)
- `process_start` / `process_stop` / `process_list` — background process lifecycle management
- `session_create` / `session_attach` — persistent terminal session management
- `task_sprint` — bounded concurrent task runner with timeout and progress tracking
- Shared `ProcessManager` and `SessionManager` singletons

**Core tools** (file, shell, git, web)

- `file_read`, `file_write`, `shell` — foundational Mind tools
- `file_move`, `file_copy`, `file_delete`, `file_glob`, `file_restore`, `file_bulk` — Hand tools with trash-based deletes, root boundary validation, glob patterns
- Full git toolset: `git_status`, `git_diff`, `git_log`, `git_branch`, `git_add`, `git_commit`, `git_show`, `git_push`, `git_pull`, `git_fetch`, `git_merge`, `git_rebase`, `git_stash_push/pop/list/drop`
- `web_search` (Tavily), `web_fetch`

**Agent system**

- `Agent` class with multi-turn loop, streaming, tool hooks (`beforeToolCall`, `afterToolCall`), steering, and follow-up queuing
- Multi-agent orchestration via `spawn_task` with 5 concurrent sub-agent limit
- Task tracking — auto-extract tasks from conversation, mark done, list open
- Rich event emission: `agent_start`, `turn_start`, `message_update`, `tool_execution_start/end`, `agent_end`

**Interfaces**

- Interactive TUI (Ink) with status bar, chat panel, tool call display, animated mascot
- Readline REPL (`--plain`)
- HTTP API server with SSE streaming (`--server`)
- One-shot CLI mode

**Infrastructure**

- 5 LLM providers: OpenAI, Anthropic, Google Gemini, OpenRouter, Tavily
- `MemoryStore` — conversation persistence in `~/.null-agent/memory/`
- `AwarenessManager` — git monitoring and file watching with real-time events
- `PermissionManager` — `auto` / `confirm` / `plan` modes with deny patterns
- `PluginManager` + `EventBus` — extension points
- `scanProject` — detect language, framework, package manager, conventions
- Interactive `null-agent auth` command with OS keychain + file fallback

---

## [0.0.0] — 2026-04-02

Initial commit. Project scaffolding, TypeScript + ESM setup, base `Agent` class, OpenAI + Anthropic provider skeletons, and initial README.
