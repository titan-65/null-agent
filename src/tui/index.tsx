import { createElement as h } from "react";
import { render } from "ink";
import { App } from "./app.tsx";
import { Agent } from "../agent/index.ts";
import {
  createProvider,
  detectProvider,
  type ProviderName,
  PROVIDERS,
} from "../providers/index.ts";
import { createDefaultRegistry } from "../tools/index.ts";
import { MemoryStore } from "../memory/store.ts";
import { scanProject } from "../context/scanner.ts";
import type { ProjectKnowledge } from "../context/types.ts";
import { AwarenessManager } from "../awareness/manager.ts";
import { loadConfig } from "../agent/personality.ts";

export async function startTui(options?: {
  provider?: ProviderName;
  model?: string;
}): Promise<void> {
  // Load user config
  const config = await loadConfig();

  const providerName = options?.provider ?? config.defaultProvider ?? detectProvider() ?? "openai";
  const provider = createProvider(providerName);
  const model = options?.model ?? config.defaultModel ?? PROVIDERS[providerName].defaultModel;
  const tools = createDefaultRegistry();

  // Initialize memory and project knowledge
  const memory = new MemoryStore();
  let projectKnowledge: ProjectKnowledge | undefined;

  try {
    projectKnowledge = await scanProject(process.cwd());
  } catch {
    // Project scanning failed, continue without it
  }

  const agent = new Agent({
    provider,
    tools,
    model,
    memory,
    projectKnowledge,
    personality: config.personality,
  });

  // Try to load previous conversation from same project
  const previousConversation = await agent.loadConversation(process.cwd());

  // If no previous conversation, start a new one
  if (!previousConversation) {
    await agent.startConversation(
      process.cwd(),
      projectKnowledge?.projectName ?? "unknown",
      providerName,
      model,
    );
  }

  // Create awareness manager
  const awareness = new AwarenessManager({
    projectDir: process.cwd(),
  });

  render(
    h(App, {
      agent,
      providerName,
      model,
      toolCount: tools.list().length,
      projectKnowledge,
      awareness,
      config,
      previousConversation: previousConversation
        ? {
            id: previousConversation.id,
            title: previousConversation.title,
            createdAt: previousConversation.createdAt,
            updatedAt: previousConversation.updatedAt,
            messageCount: previousConversation.metadata.messageCount,
            summary: previousConversation.metadata.summary,
          }
        : undefined,
    }),
  );
}
