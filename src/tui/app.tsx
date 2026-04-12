import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { StatusBar } from "./components/StatusBar.tsx";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { InputBar } from "./components/InputBar.tsx";
import { HelpOverlay } from "./components/HelpOverlay.tsx";
import { Notification } from "./components/Notification.tsx";
import { AgentBar } from "./components/AgentBar.tsx";
import { getMoodForStatus, getMoodForActivity } from "./components/NullFace.tsx";
import { DailySummary } from "./components/DailySummary.tsx";
import type { Agent } from "../agent/index.ts";
import { formatTaskList } from "../agent/tasks.ts";
import { generateSuggestions, getHighestPrioritySuggestion } from "../agent/suggestions.ts";
import { generateGreeting } from "../agent/greetings.ts";
import { getIdleActivity, getIdleIntervalMs } from "../agent/idle.ts";
import { type NullAgentConfig, formatConfig, saveConfig } from "../agent/personality.ts";
import type { ConversationSummary } from "../memory/types.ts";
import type { ProjectKnowledge } from "../context/types.ts";
import type { AwarenessManager } from "../awareness/manager.ts";
import type { AwarenessEvent } from "../awareness/types.ts";
import { PROVIDERS } from "../providers/index.ts";
import { detectProjectContext, type ProjectContext } from "./context.ts";
import { ActivityTracker } from "../accountability/tracker.ts";
import { Accountant } from "../accountability/accountant.ts";
import { Reporter } from "../accountability/reporter.ts";
import { GoalTracker } from "../accountability/goals.ts";
import { AccountabilityStore } from "../accountability/storage.ts";
import type {
  ActivityType,
  SessionStats,
  Goal,
  CalendarEvent,
  ActivitySummary,
} from "../accountability/types.ts";

export interface TuiMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }>;
  isStreaming: boolean;
}

interface AppProps {
  agent: Agent;
  providerName: string;
  model: string;
  toolCount: number;
  projectKnowledge?: ProjectKnowledge;
  previousConversation?: ConversationSummary;
  awareness?: AwarenessManager;
  config?: NullAgentConfig;
}

interface ActiveNotification {
  event: AwarenessEvent;
  createdAt: number;
}

type AgentStatus = "idle" | "thinking" | "executing" | "waiting";

const FLUSH_INTERVAL_MS = 100;
const NOTIFICATION_LIFETIME_MS = 7000;

export function App({
  agent,
  providerName,
  model,
  toolCount,
  projectKnowledge,
  previousConversation,
  awareness,
  config,
}: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<TuiMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [project, setProject] = useState<ProjectContext>();
  const [showHelp, setShowHelp] = useState(false);
  const [notification, setNotification] = useState<ActiveNotification | null>(null);
  const [notificationAge, setNotificationAge] = useState(0);
  const [faceFrame, setFaceFrame] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [showDailySummary, setShowDailySummary] = useState(true);
  const [todaysGoals, setTodaysGoals] = useState<Goal[]>([]);
  const [calendarEvents] = useState<CalendarEvent[]>([]);
  const [yesterdaySummary, setYesterdaySummary] = useState<ActivitySummary | null>(null);

  const streamBuffer = useRef("");
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountabilityStore = useRef<AccountabilityStore>(new AccountabilityStore());
  const activityTracker = useRef<ActivityTracker>(new ActivityTracker());
  const goalTracker = useRef<GoalTracker>(new GoalTracker(accountabilityStore.current));
  const reporter = useRef<Reporter | null>(null);
  const accountant = useRef<Accountant | null>(null);
  const pendingToolArgs = useRef<Map<string, Record<string, unknown>>>(new Map());

  // Always-fresh refs — updated every render so no stale-closure is possible regardless
  // of which memoised version of handleSend React serves from its cache.
  const goalCommandRef = useRef<(trimmed: string) => Promise<boolean>>(async () => false);
  const handleSendImplRef = useRef<(input: string) => Promise<void>>(async () => {});

  const currentActivityType = activityTracker.current.getCurrentActivity()?.type ?? null;
  const mood =
    status !== "idle"
      ? getMoodForStatus(status, Date.now() - lastActivityTime < 30_000)
      : getMoodForActivity(currentActivityType);

  const startFlushing = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setInterval(() => {
      const buffered = streamBuffer.current;
      if (!buffered) return;
      streamBuffer.current = "";

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && last.isStreaming) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + buffered,
          };
        }
        return updated;
      });
    }, FLUSH_INTERVAL_MS);
  }, []);

  const stopFlushing = useCallback(() => {
    if (flushTimer.current) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
    }
    const buffered = streamBuffer.current;
    if (buffered) {
      streamBuffer.current = "";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: last.content + buffered,
          };
        }
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
      if (notificationTimer.current) clearInterval(notificationTimer.current);
      if (faceTimer.current) clearInterval(faceTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      awareness?.stop();
    };
  }, [awareness]);

  // Face animation — update frame every 500ms
  useEffect(() => {
    faceTimer.current = setInterval(() => {
      setFaceFrame((f) => f + 1);
    }, 500);

    return () => {
      if (faceTimer.current) clearInterval(faceTimer.current);
    };
  }, []);

  // Initialize activity tracker, reporter, accountant, and load startup data
  useEffect(() => {
    const tracker = activityTracker.current;
    const store = accountabilityStore.current;

    tracker.init().then(async () => {
      setSessionStats(tracker.getSessionStats());

      // Load today's goals for startup summary
      const goals = await goalTracker.current.getTodaysGoals();
      setTodaysGoals(goals);

      // Load yesterday's summary
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ySummary = await tracker.getActivitySummary(yesterday);
      const hasYesterdayData =
        ySummary.totalCoding > 0 || ySummary.totalMeetings > 0 || ySummary.totalDebugging > 0;
      setYesterdaySummary(hasYesterdayData ? ySummary : null);

      // Wire up reporter and accountant
      reporter.current = new Reporter(store, tracker);
      accountant.current = new Accountant(tracker);
    });

    // Update stats every minute
    const statsInterval = setInterval(() => {
      setSessionStats(tracker.getSessionStats());
    }, 60_000);

    // Accountant polling — check for notifications every minute
    const accountantInterval = setInterval(async () => {
      if (!accountant.current) return;
      const notifications = [
        ...(await accountant.current.checkGoalProgress()),
        ...(await accountant.current.checkActivityPatterns()),
        ...accountant.current.checkDailyRituals(),
      ];
      for (const notif of notifications) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system" as const,
            content: notif.message,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      }
    }, 60_000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(accountantInterval);
    };
  }, []);

  // Idle activity — show tips/encouragement when idle
  useEffect(() => {
    const scheduleNext = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (status === "idle") {
          const activity = getIdleActivity();
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: activity.message,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        scheduleNext();
      }, getIdleIntervalMs());
    };

    scheduleNext();

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [status]);

  // Start awareness manager
  useEffect(() => {
    if (!awareness) return;

    awareness.start({
      onEvent: (event) => {
        setNotification({ event, createdAt: Date.now() });
        setNotificationAge(0);
      },
    });
  }, [awareness]);

  // Notification auto-dismiss timer
  useEffect(() => {
    if (!notification) return;

    notificationTimer.current = setInterval(() => {
      setNotificationAge((prev) => {
        const newAge = prev + 500;
        if (newAge >= NOTIFICATION_LIFETIME_MS) {
          setNotification(null);
          if (notificationTimer.current) {
            clearInterval(notificationTimer.current);
            notificationTimer.current = null;
          }
          return 0;
        }
        return newAge;
      });
    }, 500);

    return () => {
      if (notificationTimer.current) {
        clearInterval(notificationTimer.current);
        notificationTimer.current = null;
      }
    };
  }, [notification]);

  // Detect project context on mount, show welcome
  useEffect(() => {
    detectProjectContext().then((ctx) => {
      setProject(ctx);

      const welcome = buildWelcomeMessage(ctx, projectKnowledge, previousConversation);

      setMessages([
        {
          role: "system",
          content: welcome,
          toolCalls: [],
          isStreaming: false,
        },
      ]);
    });
  }, []);

  // Overwrite the ref on every render so handleSend never captures a stale closure
  goalCommandRef.current = async (trimmed: string): Promise<boolean> => {
    if (trimmed === "/goals") {
      try {
        const goals = await goalTracker.current.getTodaysGoals();
        const text =
          goals.length > 0
            ? `Today's goals:\n${goalTracker.current.formatGoalList(goals)}`
            : "No goals for today. Add one with /goal add <text>";
        setMessages((prev: TuiMessage[]) => [
          ...prev,
          { role: "system", content: text, toolCalls: [], isStreaming: false },
        ]);
      } catch (err) {
        setMessages((prev: TuiMessage[]) => [
          ...prev,
          {
            role: "system",
            content: `Error loading goals: ${err instanceof Error ? err.message : String(err)}`,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      }
      return true;
    }

    if (trimmed === "/goal") {
      setMessages((prev: TuiMessage[]) => [
        ...prev,
        {
          role: "system",
          content:
            "Goal commands:\n  /goals             List today's goals\n  /goal add <text>   Add a daily goal\n  /goal done <id>    Mark a goal complete\n  /goal rm <id>      Delete a goal",
          toolCalls: [],
          isStreaming: false,
        },
      ]);
      return true;
    }

    if (trimmed.startsWith("/goal add ")) {
      const description = trimmed.slice(10).trim();
      try {
        if (description) {
          const goal = await goalTracker.current.createGoal(description, "daily");
          const updatedGoals = await goalTracker.current.getTodaysGoals();
          setTodaysGoals(updatedGoals);
          setMessages((prev: TuiMessage[]) => [
            ...prev,
            {
              role: "system",
              content: `✓ Goal added: "${goal.description}" [${goal.id.slice(0, 8)}]`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        } else {
          setMessages((prev: TuiMessage[]) => [
            ...prev,
            { role: "system", content: "Usage: /goal add <description>", toolCalls: [], isStreaming: false },
          ]);
        }
      } catch (err) {
        setMessages((prev: TuiMessage[]) => [
          ...prev,
          {
            role: "system",
            content: `Error adding goal: ${err instanceof Error ? err.message : String(err)}`,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      }
      return true;
    }

    if (trimmed.startsWith("/goal done ")) {
      const id = trimmed.slice(11).trim();
      try {
        const all = await goalTracker.current.getAllGoals();
        const match = all.find((g) => g.id.startsWith(id));
        if (match) {
          await goalTracker.current.completeGoal(match.id);
          const updatedGoals = await goalTracker.current.getTodaysGoals();
          setTodaysGoals(updatedGoals);
          if (accountant.current) {
            setMessages((prev: TuiMessage[]) => [
              ...prev,
              {
                role: "system",
                content: accountant.current!.celebrateWin({ ...match, status: "completed" }),
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          }
        } else {
          setMessages((prev: TuiMessage[]) => [
            ...prev,
            {
              role: "system",
              content: `Goal "${id}" not found. Use /goals to list your goals.`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
      } catch (err) {
        setMessages((prev: TuiMessage[]) => [
          ...prev,
          {
            role: "system",
            content: `Error completing goal: ${err instanceof Error ? err.message : String(err)}`,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      }
      return true;
    }

    if (trimmed.startsWith("/goal rm ")) {
      const id = trimmed.slice(9).trim();
      try {
        const all = await goalTracker.current.getAllGoals();
        const match = all.find((g) => g.id.startsWith(id));
        if (match) {
          await goalTracker.current.deleteGoal(match.id);
          const updatedGoals = await goalTracker.current.getTodaysGoals();
          setTodaysGoals(updatedGoals);
          setMessages((prev: TuiMessage[]) => [
            ...prev,
            { role: "system", content: `Goal removed: "${match.description}"`, toolCalls: [], isStreaming: false },
          ]);
        } else {
          setMessages((prev: TuiMessage[]) => [
            ...prev,
            { role: "system", content: `Goal "${id}" not found.`, toolCalls: [], isStreaming: false },
          ]);
        }
      } catch (err) {
        setMessages((prev: TuiMessage[]) => [
          ...prev,
          {
            role: "system",
            content: `Error removing goal: ${err instanceof Error ? err.message : String(err)}`,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      }
      return true;
    }

    return false;
  };

  const handleSendImpl = useCallback(
    async (input: string) => {
      const trimmed = input.trim();

      // Slash commands
      if (trimmed === "/exit" || trimmed === "/quit") {
        exit();
        return;
      }

      if (trimmed === "/clear") {
        agent.clearHistory();
        setMessages([]);
        return;
      }

      if (trimmed === "/help") {
        setShowHelp((prev) => !prev);
        return;
      }

      if (trimmed === "/context") {
        if (project) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: formatContextDetails(project, projectKnowledge),
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      if (trimmed === "/history") {
        if (agent.getConversation()?.id) {
          const memory = (
            agent as unknown as {
              config: { memory?: { listConversations(n: number): Promise<ConversationSummary[]> } };
            }
          ).config.memory;
          if (memory) {
            const convs = await memory.listConversations(10);
            setShowHelp(false);

            const historyText = formatConversationList(convs);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: historyText,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          }
        }
        return;
      }

      if (trimmed.startsWith("/resume ")) {
        const id = trimmed.slice(8).trim();
        const conv = await agent.resumeConversation(id);
        if (conv) {
          setMessages([
            {
              role: "system",
              content: `Resumed conversation: ${conv.title}\n${conv.metadata.messageCount} messages loaded`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `Conversation ${id} not found`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      if (trimmed === "/tasks") {
        const tasks = agent.getTasks();
        const taskText = formatTaskList(tasks);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: taskText,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
        return;
      }

      if (trimmed.startsWith("/done ")) {
        const id = trimmed.slice(6).trim();
        const task = agent.completeTask(id);
        if (task) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `✓ Completed: ${task.description}`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `Task ${id} not found`,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      if (trimmed.startsWith("/search ")) {
        const query = trimmed.slice(8).trim();
        if (!query) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: "Usage: /search <query> — Search past conversations",
              toolCalls: [],
              isStreaming: false,
            },
          ]);
          return;
        }

        const memory = (
          agent as unknown as {
            config: {
              memory?: {
                searchConversations(opts: {
                  query: string;
                  limit: number;
                }): Promise<import("../memory/types.ts").ConversationSearchResult[]>;
              };
            };
          }
        ).config.memory;

        if (memory) {
          const results = await memory.searchConversations({ query, limit: 5 });
          const searchText = formatSearchResults(query, results);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: searchText,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      if (trimmed === "/config") {
        if (config) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: formatConfig(config),
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      if (trimmed.startsWith("/config ")) {
        const parts = trimmed.slice(8).trim().split(/\s+/);
        const key = parts[0];
        const value = parts[1];

        if (config && key && value) {
          let updated = false;
          if (key === "tone" && ["professional", "casual", "concise"].includes(value)) {
            config.personality.tone = value as "professional" | "casual" | "concise";
            updated = true;
          } else if (key === "verbosity" && ["minimal", "balanced", "detailed"].includes(value)) {
            config.personality.verbosity = value as "minimal" | "balanced" | "detailed";
            updated = true;
          } else if (key === "proactivity" && ["passive", "balanced", "active"].includes(value)) {
            config.personality.proactivity = value as "passive" | "balanced" | "active";
            updated = true;
          }

          if (updated) {
            await saveConfig(config);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Config updated: ${key} = ${value}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Unknown config: ${key} ${value}\n${formatConfig(config)}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          }
        }
        return;
      }

      if (trimmed === "/model" || trimmed === "/models") {
        const currentModel = agent.getModel();
        const providerName = agent.getProviderName();
        const providerInfo = providerName
          ? PROVIDERS[providerName as keyof typeof PROVIDERS]
          : null;
        const models = providerInfo?.models ?? [];
        const freeModels = providerInfo?.freeModels ?? [];

        let content = currentModel
          ? `Current model: ${currentModel}\n`
          : "No model set, using default\n";
        content += `\nAvailable models for ${providerInfo?.displayName ?? "unknown provider"}:\n`;
        for (const m of models) {
          content += `  • ${m}${m === currentModel ? " (current)" : ""}\n`;
        }
        if (freeModels.length > 0) {
          content += `\nFree models:\n`;
          for (const m of freeModels) {
            content += `  • ${m}\n`;
          }
        }
        content += `\nUse /model <name> to change`;

        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content,
            toolCalls: [],
            isStreaming: false,
          },
        ]);
        return;
      }

      if (trimmed.startsWith("/model ")) {
        const model = trimmed.slice(7).trim();
        if (model) {
          try {
            await agent.setModel(model);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Model changed to: ${model}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          } catch (error) {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Failed to change model: ${error instanceof Error ? error.message : String(error)}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: "Usage: /model <model-name>\nUse /models to see available models",
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
        return;
      }

      // ── Accountability commands ───────────────────────────────────────

      // Goal commands are handled via goalCommandRef so the latest implementation
      // is always used regardless of which memoised version of handleSend runs.
      if (trimmed === "/goals" || trimmed === "/goal" || trimmed.startsWith("/goal ")) {
        await goalCommandRef.current(trimmed);
        return;
      }

      if (trimmed === "/report") {
        if (reporter.current) {
          const report = await reporter.current.generateDailyReport();
          const text = reporter.current.formatDailyReport(report);
          await reporter.current.saveReport(report);
          setMessages((prev) => [
            ...prev,
            { role: "system", content: text, toolCalls: [], isStreaming: false },
          ]);
        }
        return;
      }

      if (trimmed === "/report week") {
        if (reporter.current) {
          const monday = getMondayOfCurrentWeek();
          const report = await reporter.current.generateWeeklyReport(monday);
          const text = reporter.current.formatWeeklyReport(report);
          await reporter.current.saveWeeklyReport(report);
          setMessages((prev) => [
            ...prev,
            { role: "system", content: text, toolCalls: [], isStreaming: false },
          ]);
        }
        return;
      }

      if (trimmed.startsWith("/track ")) {
        const arg = trimmed.slice(7).trim();
        if (arg === "stop") {
          const current = activityTracker.current.getCurrentActivity();
          if (current) {
            await activityTracker.current.endActivity(current.id);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Stopped tracking: ${current.description}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "system", content: "No active tracking.", toolCalls: [], isStreaming: false },
            ]);
          }
        } else {
          const validTypes: ActivityType[] = [
            "coding",
            "review",
            "debugging",
            "testing",
            "docs",
            "meeting",
            "planning",
            "standup",
            "break",
            "other",
          ];
          const type = arg as ActivityType;
          if (validTypes.includes(type)) {
            await activityTracker.current.startActivity(type);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Now tracking: ${type}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `Unknown activity type: "${arg}"\nValid types: ${validTypes.join(", ")}`,
                toolCalls: [],
                isStreaming: false,
              },
            ]);
          }
        }
        return;
      }

      // ────────────────────────────────────────────────────────────────────

      setShowHelp(false);
      setLastActivityTime(Date.now());

      // Regular chat
      const userMsg: TuiMessage = {
        role: "user",
        content: input,
        toolCalls: [],
        isStreaming: false,
      };

      const assistantMsg: TuiMessage = {
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus("thinking");

      try {
        await agent.chat(input, {
          onText: (text) => {
            setStatus("waiting");
            streamBuffer.current += text;
            startFlushing();
          },
          onToolCall: (name, args) => {
            stopFlushing();
            setStatus("executing");
            pendingToolArgs.current.set(name, args);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  toolCalls: [...last.toolCalls, { name, arguments: args }],
                };
              }
              return updated;
            });
          },
          onToolResult: (name, result, isError) => {
            setStatus("thinking");
            const args = pendingToolArgs.current.get(name) ?? {};
            pendingToolArgs.current.delete(name);
            activityTracker.current.recordToolCall(name, args, result);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  toolCalls: last.toolCalls.map((tc) =>
                    tc.name === name ? { ...tc, result, isError } : tc,
                  ),
                };
              }
              return updated;
            });
            setSessionStats(activityTracker.current.getSessionStats());
          },
        });

        stopFlushing();
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });

        // Proactive suggestion — check for follow-up opportunities
        const suggestions = generateSuggestions({
          tasks: agent.getTasks(),
          lastToolUsed: agent.getLastToolUsed(),
          lastMessage: input,
        });
        const topSuggestion = getHighestPrioritySuggestion(suggestions);
        if (topSuggestion && topSuggestion.priority !== "low") {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: topSuggestion.message,
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
      } catch (error) {
        stopFlushing();
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              isStreaming: false,
            };
          }
          return updated;
        });
      }

      setStatus("idle");
    },
    [agent, exit, project, projectKnowledge, previousConversation, startFlushing, stopFlushing],
  );

  // Keep the impl ref pointing at the freshest version on every render.
  // This is what makes the stable wrapper below safe to call at any time.
  handleSendImplRef.current = handleSendImpl;

  // Stable outer wrapper — empty deps so Ink registers exactly ONE listener and
  // never needs to re-register.  All real logic lives in handleSendImplRef.current
  // (always the latest render's version) so stale closures cannot affect behaviour.
  const handleSend = useCallback(
    (input: string) => {
      void handleSendImplRef.current(input);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
    if (key.ctrl && input === "h") {
      setShowHelp((prev) => !prev);
    }
    if (key.ctrl && input === "s") {
      setShowDailySummary((prev) => !prev);
    }
  });

  return h(
    Box,
    { flexDirection: "column", height: "100%" },
    h(StatusBar, {
      provider: providerName,
      model,
      toolCount,
      project,
      status,
      currentActivity: activityTracker.current.getCurrentActivity(),
    }),
    showDailySummary
      ? h(DailySummary, {
          stats: sessionStats,
          goals: todaysGoals,
          calendarEvents,
          yesterdaySummary,
          onClose: () => setShowDailySummary(false),
        })
      : null,
    showHelp ? h(HelpOverlay) : h(ChatPanel, { messages }),
    notification
      ? h(Notification, {
          event: notification.event,
          ageMs: notificationAge,
        })
      : null,
    h(AgentBar, {
      mood,
      frame: faceFrame,
      status: getAgentStatusText(status),
      openTaskCount: agent.getOpenTasks().length,
    }),
    h(InputBar, {
      onSubmit: handleSend,
      isDisabled: false,
      placeholder: status !== "idle" ? getStatusPrompt(status) : undefined,
    }),
  );
}

function buildWelcomeMessage(
  ctx: ProjectContext,
  projectKnowledge?: ProjectKnowledge,
  previousConversation?: ConversationSummary,
): string {
  return generateGreeting({
    projectName: ctx.projectName,
    gitBranch: ctx.gitBranch,
    hasChanges: ctx.hasChanges,
    changeCount: undefined,
    isReturning: !!previousConversation,
    lastConversationDate: previousConversation?.updatedAt,
  });
}

function formatContextDetails(ctx: ProjectContext, knowledge?: ProjectKnowledge): string {
  const lines = [`Project: ${ctx.projectName}`, `Directory: ${ctx.cwd}`];
  if (ctx.gitBranch) lines.push(`Branch: ${ctx.gitBranch}`);
  if (ctx.hasChanges) lines.push("Status: Uncommitted changes");
  if (ctx.packageManager) lines.push(`Package Manager: ${ctx.packageManager}`);
  if (knowledge?.framework) lines.push(`Framework: ${knowledge.framework}`);
  if (knowledge?.language) lines.push(`Language: ${knowledge.language}`);
  if (knowledge?.isMonorepo) lines.push(`Monorepo: ${knowledge.workspacePackages.length} packages`);
  if (knowledge?.conventions.typescript) lines.push("TypeScript: yes");
  return lines.join("\n");
}

function formatConversationList(convs: ConversationSummary[]): string {
  if (convs.length === 0) return "No past conversations found.";

  const lines = ["## Past Conversations", ""];
  for (const conv of convs) {
    const date = new Date(conv.updatedAt).toLocaleDateString();
    const msgs = conv.messageCount;
    lines.push(`- [${conv.id}] "${conv.title}" (${date}, ${msgs} messages)`);
  }
  lines.push("");
  lines.push("Use /resume <id> to continue a conversation");

  return lines.join("\n");
}

function formatSearchResults(
  query: string,
  results: import("../memory/types.ts").ConversationSearchResult[],
): string {
  if (results.length === 0) return `No results found for "${query}".`;

  const lines = [`## Search Results for "${query}"`, ""];

  for (const result of results) {
    const date = new Date(result.updatedAt).toLocaleDateString();
    lines.push(`### ${result.title}`);
    lines.push(`ID: ${result.id} · ${date} · ${result.messageCount} messages`);

    for (const match of result.matches.slice(0, 2)) {
      lines.push(`  ${match}`);
    }
    lines.push("");
  }

  lines.push("Use /resume <id> to continue a conversation");
  return lines.join("\n");
}

function getStatusPrompt(status: AgentStatus): string {
  switch (status) {
    case "thinking":
      return "Thinking...";
    case "executing":
      return "Running tool...";
    case "waiting":
      return "Streaming response...";
    default:
      return "";
  }
}

function getAgentStatusText(status: AgentStatus): string {
  switch (status) {
    case "thinking":
      return "thinking...";
    case "executing":
      return "running tool...";
    case "waiting":
      return "responding...";
    default:
      return "ready";
  }
}

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
