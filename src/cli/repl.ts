import { createInterface } from "node:readline";
import { Agent } from "../agent/index.ts";
import {
  createProvider,
  detectProvider,
  type ProviderName,
  PROVIDERS,
} from "../providers/index.ts";
import { createDefaultRegistry } from "../tools/index.ts";
import {
  printAssistant,
  printError,
  printToolCall,
  printToolResult,
  printWelcome,
} from "./output.ts";
import { AccountabilityStore } from "../accountability/storage.ts";
import { GoalTracker } from "../accountability/goals.ts";

export async function startRepl(options?: {
  provider?: ProviderName;
  model?: string;
}): Promise<void> {
  const providerName = options?.provider ?? detectProvider() ?? "openai";
  const provider = createProvider(providerName);
  const model = options?.model ?? PROVIDERS[providerName].defaultModel;

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

  const store = new AccountabilityStore();
  const goalTracker = new GoalTracker(store);

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

    if (trimmed === "/goals") {
      const goals = await goalTracker.getTodaysGoals();
      if (goals.length > 0) {
        console.log(`\x1b[90mToday's goals:\n${goalTracker.formatGoalList(goals)}\x1b[0m`);
      } else {
        console.log("\x1b[90mNo goals for today. Add one with /goal add <text>\x1b[0m");
      }
      continue;
    }

    if (trimmed === "/goal") {
      console.log(
        "\x1b[90mUsage:\n  /goals             List today's goals\n  /goal add <text>   Add a goal\n  /goal done <id>    Mark a goal complete\n  /goal rm <id>      Delete a goal\x1b[0m",
      );
      continue;
    }

    if (trimmed.startsWith("/goal add ")) {
      const description = trimmed.slice(10).trim();
      if (description) {
        const goal = await goalTracker.createGoal(description, "daily");
        console.log(
          `\x1b[90m✓ Goal added: "${goal.description}" [${goal.id.slice(0, 8)}]\x1b[0m`,
        );
      } else {
        console.log("\x1b[90mUsage: /goal add <description>\x1b[0m");
      }
      continue;
    }

    if (trimmed.startsWith("/goal done ")) {
      const id = trimmed.slice(11).trim();
      const all = await goalTracker.getAllGoals();
      const match = all.find((g) => g.id.startsWith(id));
      if (match) {
        await goalTracker.completeGoal(match.id);
        console.log(`\x1b[90m✓ Completed: "${match.description}"\x1b[0m`);
      } else {
        console.log(`\x1b[90mGoal "${id}" not found. Use /goals to list your goals.\x1b[0m`);
      }
      continue;
    }

    if (trimmed.startsWith("/goal rm ")) {
      const id = trimmed.slice(9).trim();
      const all = await goalTracker.getAllGoals();
      const match = all.find((g) => g.id.startsWith(id));
      if (match) {
        await goalTracker.deleteGoal(match.id);
        console.log(`\x1b[90mGoal removed: "${match.description}"\x1b[0m`);
      } else {
        console.log(`\x1b[90mGoal "${id}" not found.\x1b[0m`);
      }
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
