import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export type Tone = "professional" | "casual" | "concise";
export type Verbosity = "minimal" | "balanced" | "detailed";
export type Proactivity = "passive" | "balanced" | "active";

export interface PersonalityConfig {
  tone: Tone;
  verbosity: Verbosity;
  proactivity: Proactivity;
}

export interface NullAgentConfig {
  personality: PersonalityConfig;
  defaultProvider?: "openai" | "anthropic";
  defaultModel?: string;
}

const CONFIG_DIR = join(homedir(), ".null-agent");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: NullAgentConfig = {
  personality: {
    tone: "casual",
    verbosity: "balanced",
    proactivity: "balanced",
  },
};

export async function loadConfig(): Promise<NullAgentConfig> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<NullAgentConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      personality: {
        ...DEFAULT_CONFIG.personality,
        ...parsed.personality,
      },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: NullAgentConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getPersonalityPrompt(config: PersonalityConfig): string {
  const parts: string[] = [];

  // Tone
  switch (config.tone) {
    case "professional":
      parts.push("Communication: Formal and precise. Use complete sentences.");
      break;
    case "casual":
      parts.push(
        "Communication: Friendly and conversational. Like a helpful colleague. Light humor is fine.",
      );
      break;
    case "concise":
      parts.push("Communication: Ultra-brief. Minimize words. Bullet points over paragraphs.");
      break;
  }

  // Verbosity
  switch (config.verbosity) {
    case "minimal":
      parts.push("Responses: One sentence if possible. Skip explanations unless asked.");
      break;
    case "balanced":
      parts.push("Responses: 2-4 sentences. Explain the 'why' briefly when it helps.");
      break;
    case "detailed":
      parts.push("Responses: Thorough explanations. Include context, alternatives, and reasoning.");
      break;
  }

  // Proactivity
  switch (config.proactivity) {
    case "passive":
      parts.push("Suggestions: Only when directly asked. Don't volunteer extra information.");
      break;
    case "balanced":
      parts.push("Suggestions: Offer when clearly relevant. Don't over-suggest.");
      break;
    case "active":
      parts.push(
        "Suggestions: Proactively flag issues, suggest improvements, and anticipate needs.",
      );
      break;
  }

  return parts.join("\n");
}

export function formatConfig(config: NullAgentConfig): string {
  const lines = [
    "## Configuration",
    "",
    `Tone: ${config.personality.tone}`,
    `Verbosity: ${config.personality.verbosity}`,
    `Proactivity: ${config.personality.proactivity}`,
  ];
  if (config.defaultProvider) {
    lines.push(`Default Provider: ${config.defaultProvider}`);
  }
  if (config.defaultModel) {
    lines.push(`Default Model: ${config.defaultModel}`);
  }
  lines.push("");
  lines.push("Use `/config tone <casual|professional|concise>` to change");
  lines.push("Use `/config verbosity <minimal|balanced|detailed>` to change");
  lines.push("Use `/config proactivity <passive|balanced|active>` to change");
  return lines.join("\n");
}
