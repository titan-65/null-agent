#!/usr/bin/env node

import type { ProviderName } from "../providers/index.ts";

const args = process.argv.slice(2);

function printHelp(): void {
  console.log(`
null-agent - Interactive coding assistant

Usage:
  null-agent                  Start interactive TUI
  null-agent "your message"   One-shot mode
  null-agent --plain          Start plain readline REPL
  null-agent --server         Start HTTP API server
  null-agent auth             Configure API keys interactively
  null-agent auth status      Show API key status
  null-agent auth <provider>  Configure one provider (openai, anthropic, gemini, openrouter)
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

Keys are stored in ~/.null-agent/credentials.json
`);
}

async function main(): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // Auth commands
  if (args[0] === "auth") {
    const { interactiveAuth, printAuthStatus } = await import("../auth/index.ts");
    const provider = args[1]; // null-agent auth <provider>
    if (provider === "status") {
      await printAuthStatus();
    } else {
      await interactiveAuth(provider);
    }
    process.exit(0);
  }

  // Load stored credentials into process.env
  const { loadCredentials } = await import("../auth/index.ts");
  const stored = await loadCredentials();
  for (const [provider, key] of Object.entries(stored)) {
    const envKey = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      gemini: "GEMINI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
    }[provider];
    if (envKey && !process.env[envKey]) {
      process.env[envKey] = key;
    }
  }

  const providerIndex = args.indexOf("--provider");
  const modelIndex = args.indexOf("--model");
  const portIndex = args.indexOf("--port");
  const hostIndex = args.indexOf("--host");
  const plainMode = args.includes("--plain");
  const serverMode = args.includes("--server");

  const provider = providerIndex !== -1 ? (args[providerIndex + 1] as ProviderName) : undefined;
  const model = modelIndex !== -1 ? args[modelIndex + 1] : undefined;
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1]!, 10) : 3737;
  const host = hostIndex !== -1 ? args[hostIndex + 1]! : "127.0.0.1";

  // Collect non-flag arguments as the one-shot message
  const positionalArgs = args.filter(
    (arg, i) =>
      !arg.startsWith("--") &&
      (providerIndex === -1 || i !== providerIndex + 1) &&
      (modelIndex === -1 || i !== modelIndex + 1) &&
      (portIndex === -1 || i !== portIndex + 1) &&
      (hostIndex === -1 || i !== hostIndex + 1),
  );

  // Resolve provider
  const { detectProvider, createProvider, ProviderError } = await import("../providers/index.ts");

  const providerName = provider ?? detectProvider();

  if (!providerName) {
    printNoProviderError();
    process.exit(1);
  }

  try {
    if (positionalArgs.length > 0) {
      // One-shot mode
      const { Agent } = await import("../agent/index.ts");
      const { createDefaultRegistry } = await import("../tools/index.ts");

      const llmProvider = createProvider(providerName, { model });
      const agent = new Agent({
        provider: llmProvider,
        tools: createDefaultRegistry(),
        model,
      });

      const message = positionalArgs.join(" ");
      const result = await agent.chat(message, {
        onText: (text) => process.stdout.write(text),
        onToolCall: (name) => {
          process.stderr.write(`\n  ⚙ ${name}\n`);
        },
        onToolResult: (name, result, isError) => {
          const prefix = isError ? "✗" : "✓";
          process.stderr.write(`  ${prefix} ${name}\n`);
        },
      });

      if (!result.content) {
        process.stdout.write("\n");
      }
    } else if (serverMode) {
      // API server mode
      const { startServer } = await import("../server/index.ts");
      await startServer({ port, host, provider: providerName, model });
    } else if (plainMode) {
      // Plain readline REPL
      const { startRepl } = await import("./repl.ts");
      await startRepl({ provider: providerName, model });
    } else {
      // TUI mode (default) - try to load, fallback to plain REPL
      try {
        const { startTui } = await import("../tui/index.tsx");
        await startTui({ provider: providerName, model });
      } catch (error) {
        if (String(error).includes("Cannot find package")) {
          console.error(
            "TUI requires 'ink' and 'react'. Falling back to plain REPL.\n",
          );
          console.error("Install TUI deps: npm install ink react @inkjs/ui\n");
          const { startRepl } = await import("./repl.ts");
          await startRepl({ provider: providerName, model });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

function printNoProviderError(): void {
  console.error(`
  No API key found.

  Quick setup (interactive):
    null-agent auth              Configure all providers
    null-agent auth openai       Configure one provider

  Or set environment variables:
    export OPENAI_API_KEY='sk-...'
    export ANTHROPIC_API_KEY='sk-ant-...'
    export GEMINI_API_KEY='...'         (free tier available)
    export OPENROUTER_API_KEY='...'     (free models available)

  Free options:
    • Google Gemini — free tier with gemini-2.0-flash
    • OpenRouter — free models like gemini-2.0-flash, llama-3.1

  Get a free Gemini key:  https://aistudio.google.com/apikey
  Get a free OpenRouter key: https://openrouter.ai/keys
`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
