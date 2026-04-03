import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

const AUTH_DIR = join(homedir(), ".null-agent");
const AUTH_FILE = join(AUTH_DIR, "credentials.json");

export interface AuthCredentials {
  [provider: string]: string;
}

export interface AuthPrompt {
  provider: string;
  displayName: string;
  envKey: string;
  instructions: string;
  getKeyUrl: string;
}

export const AUTH_PROMPTS: AuthPrompt[] = [
  {
    provider: "openai",
    displayName: "OpenAI",
    envKey: "OPENAI_API_KEY",
    instructions: "Enter your OpenAI API key (sk-...)",
    getKeyUrl: "https://platform.openai.com/api-keys",
  },
  {
    provider: "anthropic",
    displayName: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    instructions: "Enter your Anthropic API key (sk-ant-...)",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    provider: "gemini",
    displayName: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    instructions: "Enter your Gemini API key (free tier available)",
    getKeyUrl: "https://aistudio.google.com/apikey",
  },
  {
    provider: "openrouter",
    displayName: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    instructions: "Enter your OpenRouter API key (free models available)",
    getKeyUrl: "https://openrouter.ai/keys",
  },
];

export async function loadCredentials(): Promise<AuthCredentials> {
  try {
    const data = await readFile(AUTH_FILE, "utf-8");
    return JSON.parse(data) as AuthCredentials;
  } catch {
    return {};
  }
}

export async function saveCredentials(credentials: AuthCredentials): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(credentials, null, 2), "utf-8");
}

export async function getCredential(provider: string): Promise<string | null> {
  // Check env var first
  const prompt = AUTH_PROMPTS.find((p) => p.provider === provider);
  if (prompt) {
    const envValue = process.env[prompt.envKey];
    if (envValue) return envValue;
  }

  // Check stored credentials
  const credentials = await loadCredentials();
  return credentials[provider] ?? null;
}

export async function setCredential(provider: string, key: string): Promise<void> {
  const credentials = await loadCredentials();
  credentials[provider] = key;
  await saveCredentials(credentials);
}

export async function removeCredential(provider: string): Promise<void> {
  const credentials = await loadCredentials();
  delete credentials[provider];
  await saveCredentials(credentials);
}

export async function interactiveAuth(provider?: string): Promise<void> {
  const prompts = provider ? AUTH_PROMPTS.filter((p) => p.provider === provider) : AUTH_PROMPTS;

  if (prompts.length === 0) {
    console.error(`Unknown provider: ${provider}`);
    console.error(`Available: ${AUTH_PROMPTS.map((p) => p.provider).join(", ")}`);
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(question, resolve);
    });

  console.log("\n  null-agent — Configure API Keys\n");

  // If no provider specified, let user choose
  let selectedPrompts = prompts;
  if (!provider) {
    console.log("  Select a provider to configure:\n");
    for (let i = 0; i < AUTH_PROMPTS.length; i++) {
      const p = AUTH_PROMPTS[i]!;
      const hasKey = !!(await getCredential(p.provider));
      const status = hasKey ? "\x1b[32m✓ configured\x1b[0m" : "\x1b[90mnot set\x1b[0m";
      console.log(`    ${i + 1}. ${p.displayName} ${status}`);
    }
    console.log(`\n    0. Configure all\n`);

    const choice = await ask("  Enter number (or provider name): ");
    const index = parseInt(choice, 10);

    if (index === 0) {
      selectedPrompts = AUTH_PROMPTS;
    } else if (!isNaN(index) && index > 0 && index <= AUTH_PROMPTS.length) {
      selectedPrompts = [AUTH_PROMPTS[index - 1]!];
    } else {
      const match = AUTH_PROMPTS.find(
        (p) => p.provider === choice || p.displayName.toLowerCase() === choice.toLowerCase(),
      );
      if (match) {
        selectedPrompts = [match];
      } else {
        console.error(`\n  Unknown selection: ${choice}`);
        rl.close();
        return;
      }
    }
  }

  for (const p of selectedPrompts) {
    const existing = await getCredential(p.provider);
    const masked = existing ? `${existing.slice(0, 8)}...${existing.slice(-4)}` : "not set";

    console.log(`\n  \x1b[1m${p.displayName}\x1b[0m`);
    console.log(`  Get a key: ${p.getKeyUrl}`);
    console.log(`  Current: ${masked}\n`);

    const key = await ask(`  ${p.instructions}\n  > `);

    if (key.trim()) {
      await setCredential(p.provider, key.trim());
      console.log(`  \x1b[32m✓ Saved ${p.displayName} key\x1b[0m`);

      // Also set in current process env
      process.env[p.envKey] = key.trim();
    } else {
      console.log(`  \x1b[90mSkipped\x1b[0m`);
    }
  }

  console.log("\n  Done. Keys are stored in ~/.null-agent/credentials.json\n");
  rl.close();
}

export async function printAuthStatus(): Promise<void> {
  console.log("\n  null-agent — API Key Status\n");

  for (const p of AUTH_PROMPTS) {
    const envKey = process.env[p.envKey];
    const stored = await getCredential(p.provider);

    let status: string;
    if (envKey) {
      status = `\x1b[32m✓ env (${p.envKey})\x1b[0m`;
    } else if (stored) {
      status = `\x1b[32m✓ stored\x1b[0m`;
    } else {
      status = `\x1b[90mnot set\x1b[0m`;
    }

    console.log(`  ${p.displayName.padEnd(16)} ${status}`);
  }

  console.log(`\n  Run: null-agent auth          to configure`);
  console.log(`  Run: null-agent auth <provider> to configure one provider\n`);
}
