import { createInterface } from "node:readline";
import { Agent } from "../agent/index.ts";
import type { ProviderName } from "../providers/index.ts";
import { createProvider } from "../providers/index.ts";
import { createDefaultRegistry } from "../tools/index.ts";
import {
  printAssistant,
  printError,
  printToolCall,
  printToolResult,
  printWelcome,
} from "./output.ts";

export async function startRepl(options?: {
  provider?: ProviderName;
  model?: string;
}): Promise<void> {
  const providerName = options?.provider ?? getProviderFromEnv();
  const provider = createProvider(providerName);
  const model = options?.model ?? getDefaultModel(providerName);

  const agent = new Agent({
    provider,
    tools: createDefaultRegistry(),
    model,
  });

  printWelcome(providerName, model);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

  while (true) {
    const input = await ask("\x1b[1m>\x1b[0m ");
    const trimmed = input.trim();

    if (!trimmed) continue;

    if (trimmed === "/exit" || trimmed === "/quit") {
      console.log("Goodbye!");
      rl.close();
      break;
    }

    if (trimmed === "/clear") {
      agent.clearHistory();
      console.log("\x1b[90mHistory cleared.\x1b[0m");
      continue;
    }

    try {
      const result = await agent.chat(trimmed, {
        onText: (text) => {
          process.stdout.write(text);
        },
        onToolCall: (name, args) => {
          printToolCall(name, args);
        },
        onToolResult: (name, result, isError) => {
          printToolResult(name, result, isError);
        },
      });

      if (!result.content) {
        printAssistant(result.content || "(no response)");
      } else {
        process.stdout.write("\n");
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
    }
  }
}

function getProviderFromEnv(): ProviderName {
  if (process.env["ANTHROPIC_API_KEY"]) return "anthropic";
  if (process.env["OPENAI_API_KEY"]) return "openai";
  return "anthropic"; // default
}

function getDefaultModel(provider: ProviderName): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
  }
}
