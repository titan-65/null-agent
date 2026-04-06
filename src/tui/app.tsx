import { createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { StatusBar } from "./components/StatusBar.tsx";
import { ChatPanel } from "./components/ChatPanel.tsx";
import { InputBar } from "./components/InputBar.tsx";
import { HelpOverlay } from "./components/HelpOverlay.tsx";
import { Notification } from "./components/Notification.tsx";
import { AgentBar } from "./components/AgentBar.tsx";
import { getMoodForStatus } from "./components/NullFace.tsx";
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
import { detectProjectContext, type ProjectContext } from "./context.ts";

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

  const streamBuffer = useRef("");
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mood = getMoodForStatus(status, Date.now() - lastActivityTime < 30_000);

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

  const handleSend = useCallback(
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
            config: { memory?: { searchConversations(opts: { query: string; limit: number }): Promise<import("../memory/types.ts").ConversationSearchResult[]> } };
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

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
    if (key.ctrl && input === "h") {
      setShowHelp((prev) => !prev);
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
    }),
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

function formatSearchResults(query: string, results: import("../memory/types.ts").ConversationSearchResult[]): string {
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
