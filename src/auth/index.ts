import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

let keytar: typeof import("keytar") | null = null;
try {
  keytar = await import("keytar");
} catch {
  // Keytar not available — will use file-based fallback
}

const SERVICE_NAME = "null-agent";
const ACCOUNT_PREFIX = "api-key-";

const CREDENTIALS_DIR = join(homedir(), ".null-agent");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

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
  {
    provider: "tavily",
    displayName: "Tavily",
    envKey: "TAVILY_API_KEY",
    instructions: "Enter your Tavily API key",
    getKeyUrl: "https://tavily.com/",
  },
];

// File-based credential storage (fallback when keytar unavailable)

async function loadFileCredentials(): Promise<AuthCredentials> {
  try {
    const data = await readFile(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(data) as AuthCredentials;
  } catch {
    return {};
  }
}

async function saveFileCredentials(credentials: AuthCredentials): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), "utf-8");
}

// Public API

export async function loadCredentials(): Promise<AuthCredentials> {
  const credentials: AuthCredentials = {};

  // Load from keychain if available
  if (keytar) {
    try {
      const credentialsList = await keytar.findCredentials(SERVICE_NAME);
      for (const cred of credentialsList) {
        const provider = cred.account.replace(ACCOUNT_PREFIX, "");
        credentials[provider] = cred.password;
      }
    } catch {
      // Keychain not available — continue to file
    }
  }

  // Always merge with file credentials (file acts as fallback)
  const fileCreds = await loadFileCredentials();
  for (const [provider, key] of Object.entries(fileCreds)) {
    if (key && !credentials[provider]) {
      credentials[provider] = key;
    }
  }

  return credentials;
}

export async function saveCredentials(credentials: AuthCredentials): Promise<void> {
  if (keytar) {
    try {
      const existing = await keytar.findCredentials(SERVICE_NAME);
      for (const cred of existing) {
        await keytar.deletePassword(SERVICE_NAME, cred.account);
      }
      for (const [provider, key] of Object.entries(credentials)) {
        if (key) {
          await keytar.setPassword(SERVICE_NAME, `${ACCOUNT_PREFIX}${provider}`, key);
        }
      }
      return;
    } catch {
      // Keychain error — fall through to file
    }
  }

  await saveFileCredentials(credentials);
}

export async function getCredential(provider: string): Promise<string | null> {
  const prompt = AUTH_PROMPTS.find((p) => p.provider === provider);
  if (prompt) {
    const envValue = process.env[prompt.envKey];
    if (envValue) return envValue;
  }

  if (keytar) {
    try {
      const key = await keytar.getPassword(SERVICE_NAME, `${ACCOUNT_PREFIX}${provider}`);
      if (key) return key;
    } catch {
      // Keychain error — fall through to file
    }
  }

  const fileCreds = await loadFileCredentials();
  return fileCreds[provider] ?? null;
}

export async function setCredential(provider: string, key: string): Promise<void> {
  let savedToKeychain = false;

  if (keytar) {
    try {
      await keytar.setPassword(SERVICE_NAME, `${ACCOUNT_PREFIX}${provider}`, key);
      savedToKeychain = true;
    } catch {
      // Keychain error — fall through to file
    }
  }

  // Always save to file as backup (for fallback if keychain access fails later)
  const credentials = await loadFileCredentials();
  credentials[provider] = key;
  await saveFileCredentials(credentials);

  return;
}

export async function removeCredential(provider: string): Promise<void> {
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, `${ACCOUNT_PREFIX}${provider}`);
      return;
    } catch {
      // Keychain error — fall through to file
    }
  }

  const credentials = await loadFileCredentials();
  delete credentials[provider];
  await saveFileCredentials(credentials);
}

export function isKeychainAvailable(): boolean {
  return keytar !== null;
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

  const useKeychain = isKeychainAvailable();

  console.log("\n  null-agent — Configure API Keys\n");
  console.log(
    useKeychain
      ? "  Keys are stored securely in the OS keychain.\n"
      : "  Keys are stored in ~/.null-agent/credentials.json (plaintext).\n",
  );

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
      const storageMsg = useKeychain ? "(encrypted)" : "";
      console.log(`  \x1b[32m✓ Saved ${p.displayName} key ${storageMsg}\x1b[0m`);

      // Also set in current process env
      process.env[p.envKey] = key.trim();
    } else {
      console.log(`  \x1b[90mSkipped\x1b[0m`);
    }
  }

  console.log(
    useKeychain
      ? "\n  Done. Keys are stored securely in the OS keychain.\n"
      : "\n  Done. Keys are stored in ~/.null-agent/credentials.json.\n",
  );
  rl.close();
}

export async function printAuthStatus(): Promise<void> {
  const useKeychain = isKeychainAvailable();

  console.log("\n  null-agent — API Key Status\n");
  console.log(
    useKeychain
      ? "  Keys are stored securely in the OS keychain.\n"
      : "  Keys are stored in ~/.null-agent/credentials.json (plaintext).\n",
  );

  for (const p of AUTH_PROMPTS) {
    const envKey = process.env[p.envKey];
    const stored = await getCredential(p.provider);

    let status: string;
    if (envKey) {
      status = `\x1b[32m✓ env (${p.envKey})\x1b[0m`;
    } else if (stored) {
      status = useKeychain ? `\x1b[32m✓ stored (encrypted)\x1b[0m` : `\x1b[32m✓ stored\x1b[0m`;
    } else {
      status = `\x1b[90mnot set\x1b[0m`;
    }

    console.log(`  ${p.displayName.padEnd(16)} ${status}`);
  }

  console.log(`\n  Run: null-agent auth          to configure`);
  console.log(`  Run: null-agent auth <provider> to configure one provider\n`);
}
