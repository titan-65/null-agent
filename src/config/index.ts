import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export type Tone = "professional" | "casual" | "concise";
export type Verbosity = "minimal" | "balanced" | "detailed";
export type Proactivity = "passive" | "balanced" | "active";
export type PermissionMode = "auto" | "confirm" | "plan";

export interface PersonalityConfig {
  tone: Tone;
  verbosity: Verbosity;
  proactivity: Proactivity;
}

export interface NullAgentConfig {
  personality: PersonalityConfig;
  permissions: PermissionConfig;
  provider: ProviderConfig;
  plugins: string[];
}

export interface PermissionConfig {
  mode: PermissionMode;
  allowWrite: boolean;
  allowShell: boolean;
  allowGit: boolean;
  denyPatterns: string[];
}

export interface ProviderConfig {
  default?: "openai" | "anthropic";
  model?: string;
  apiKey?: string;
}

export interface ConfigSource {
  name: string;
  priority: number;
  config: Partial<NullAgentConfig>;
}

const USER_CONFIG_DIR = join(homedir(), ".null-agent");
const USER_CONFIG_FILE = join(USER_CONFIG_DIR, "config.json");
const PROJECT_CONFIG_FILE = ".null-agent.json";

const DEFAULT_CONFIG: NullAgentConfig = {
  personality: {
    tone: "casual",
    verbosity: "balanced",
    proactivity: "balanced",
  },
  permissions: {
    mode: "auto",
    allowWrite: true,
    allowShell: true,
    allowGit: true,
    denyPatterns: [],
  },
  provider: {},
  plugins: [],
};

export async function loadConfig(projectDir?: string): Promise<NullAgentConfig> {
  const sources: ConfigSource[] = [];

  // 1. Defaults (lowest priority)
  sources.push({ name: "defaults", priority: 0, config: DEFAULT_CONFIG });

  // 2. Environment variables
  const envConfig = loadFromEnv();
  if (envConfig) {
    sources.push({ name: "env", priority: 1, config: envConfig });
  }

  // 3. User config (~/.null-agent/config.json)
  const userConfig = await loadFromFile(USER_CONFIG_FILE);
  if (userConfig) {
    sources.push({ name: "user", priority: 2, config: userConfig });
  }

  // 4. Project config (.null-agent.json in project root) (highest priority)
  if (projectDir) {
    const projectConfig = await loadFromFile(join(projectDir, PROJECT_CONFIG_FILE));
    if (projectConfig) {
      sources.push({ name: "project", priority: 3, config: projectConfig });
    }
  }

  // Merge in priority order
  return mergeConfigs(sources);
}

function loadFromEnv(): Partial<NullAgentConfig> | null {
  const config: Partial<NullAgentConfig> = {};

  if (process.env["OPENAI_API_KEY"]) {
    config.provider = {
      default: "openai",
      apiKey: process.env["OPENAI_API_KEY"],
    };
  } else if (process.env["ANTHROPIC_API_KEY"]) {
    config.provider = {
      default: "anthropic",
      apiKey: process.env["ANTHROPIC_API_KEY"],
    };
  }

  if (process.env["NULL_AGENT_MODEL"]) {
    config.provider = {
      ...config.provider,
      model: process.env["NULL_AGENT_MODEL"],
    };
  }

  if (process.env["NULL_AGENT_PERMISSION_MODE"]) {
    config.permissions = {
      ...DEFAULT_CONFIG.permissions,
      mode: process.env["NULL_AGENT_PERMISSION_MODE"] as PermissionMode,
    };
  }

  return Object.keys(config).length > 0 ? config : null;
}

async function loadFromFile(path: string): Promise<Partial<NullAgentConfig> | null> {
  try {
    const data = await readFile(path, "utf-8");
    return JSON.parse(data) as Partial<NullAgentConfig>;
  } catch {
    return null;
  }
}

function mergeConfigs(sources: ConfigSource[]): NullAgentConfig {
  const sorted = [...sources].sort((a, b) => a.priority - b.priority);

  let result = { ...DEFAULT_CONFIG };

  for (const source of sorted) {
    const c = source.config;
    if (c.personality) {
      result.personality = { ...result.personality, ...c.personality };
    }
    if (c.permissions) {
      result.permissions = { ...result.permissions, ...c.permissions };
    }
    if (c.provider) {
      result.provider = { ...result.provider, ...c.provider };
    }
    if (c.plugins) {
      result.plugins = [...new Set([...result.plugins, ...c.plugins])];
    }
  }

  return result;
}
