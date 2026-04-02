import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Conversation, ConversationSummary } from "./types.ts";
import type { Message } from "../providers/types.ts";

const MEMORY_DIR = join(homedir(), ".null-agent", "memory");

export class MemoryStore {
  private memoryDir: string;

  constructor(baseDir?: string) {
    this.memoryDir = baseDir ?? MEMORY_DIR;
  }

  async init(): Promise<void> {
    await mkdir(this.memoryDir, { recursive: true });
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.init();
    const filePath = join(this.memoryDir, `${conversation.id}.json`);
    const data = JSON.stringify(conversation, null, 2);
    await writeFile(filePath, data, "utf-8");
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    try {
      const filePath = join(this.memoryDir, `${id}.json`);
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as Conversation;
    } catch {
      return null;
    }
  }

  async listConversations(limit = 20): Promise<ConversationSummary[]> {
    await this.init();
    try {
      const files = await readdir(this.memoryDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const summaries: ConversationSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const data = await readFile(join(this.memoryDir, file), "utf-8");
          const conv = JSON.parse(data) as Conversation;
          summaries.push({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: conv.metadata.messageCount,
            summary: conv.metadata.summary,
          });
        } catch {
          // Skip corrupted files
        }
      }

      // Sort by most recent first
      summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return summaries.slice(0, limit);
    } catch {
      return [];
    }
  }

  async getLatestConversation(projectDir?: string): Promise<Conversation | null> {
    const summaries = await this.listConversations(50);
    if (summaries.length === 0) return null;

    // If project dir specified, prefer conversations from same project
    if (projectDir) {
      for (const summary of summaries) {
        const conv = await this.loadConversation(summary.id);
        if (conv && conv.metadata.projectDir === projectDir) {
          return conv;
        }
      }
    }

    // Return most recent
    return this.loadConversation(summaries[0]!.id);
  }

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(join(this.memoryDir, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }
}

export function createConversation(
  projectDir: string,
  projectName: string,
  provider: string,
  model: string,
): Conversation {
  const now = new Date().toISOString();
  const id = generateId();

  return {
    id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
    metadata: {
      projectDir,
      projectName,
      provider,
      model,
      messageCount: 0,
    },
  };
}

export function updateConversation(conversation: Conversation, messages: Message[]): Conversation {
  const title = generateTitle(messages);
  const summary = generateSummary(messages);

  return {
    ...conversation,
    title,
    updatedAt: new Date().toISOString(),
    messages,
    metadata: {
      ...conversation.metadata,
      messageCount: messages.length,
      summary,
    },
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New conversation";
  const text = firstUser.content.trim();
  if (text.length <= 50) return text;
  return text.slice(0, 47) + "...";
}

function generateSummary(messages: Message[]): string {
  if (messages.length < 2) return "";
  const topics = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "user") {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 4 && !commonWords.has(w)) {
          topics.add(w);
        }
      }
    }
  }
  return Array.from(topics).slice(0, 5).join(", ");
}

const commonWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "being",
  "could",
  "does",
  "each",
  "from",
  "have",
  "help",
  "here",
  "just",
  "like",
  "make",
  "more",
  "most",
  "much",
  "only",
  "other",
  "over",
  "should",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "very",
  "what",
  "when",
  "which",
  "while",
  "will",
  "with",
  "would",
  "your",
  "file",
  "files",
  "code",
  "what's",
  "tell",
  "show",
  "give",
]);
