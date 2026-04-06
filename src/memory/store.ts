import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  Conversation,
  ConversationSummary,
  ConversationSearchResult,
  SearchOptions,
} from "./types.ts";
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

  async searchConversations(options: SearchOptions): Promise<ConversationSearchResult[]> {
    await this.init();
    const { query, limit = 10, projectDir } = options;

    if (!query.trim()) return [];

    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (terms.length === 0) return [];

    try {
      const files = await readdir(this.memoryDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const results: Array<ConversationSearchResult & { score: number }> = [];

      for (const file of jsonFiles) {
        try {
          const data = await readFile(join(this.memoryDir, file), "utf-8");
          const conv = JSON.parse(data) as Conversation;

          // Filter by project if specified
          if (projectDir && conv.metadata.projectDir !== projectDir) continue;

          const matches: string[] = [];
          let score = 0;

          // Search title
          const titleLower = conv.title.toLowerCase();
          for (const term of terms) {
            if (titleLower.includes(term)) {
              score += 10;
              matches.push(`title: "${conv.title}"`);
              break;
            }
          }

          // Search summary
          if (conv.metadata.summary) {
            const summaryLower = conv.metadata.summary.toLowerCase();
            for (const term of terms) {
              if (summaryLower.includes(term)) {
                score += 5;
                matches.push(`summary: "${conv.metadata.summary}"`);
                break;
              }
            }
          }

          // Search messages
          for (const msg of conv.messages) {
            const contentLower = msg.content.toLowerCase();
            let msgMatches = false;
            for (const term of terms) {
              if (contentLower.includes(term)) {
                msgMatches = true;
                score += 1;
              }
            }
            if (msgMatches && matches.length < 3) {
              const snippet = msg.content.length > 80
                ? msg.content.slice(0, 77) + "..."
                : msg.content;
              matches.push(`${msg.role}: "${snippet.replace(/\n/g, " ")}"`);
            }
          }

          if (score > 0) {
            results.push({
              id: conv.id,
              title: conv.title,
              updatedAt: conv.updatedAt,
              matches,
              messageCount: conv.metadata.messageCount,
              score,
            });
          }
        } catch {
          // Skip corrupted files
        }
      }

      // Sort by score (highest first), then by recency
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return results.slice(0, limit).map(({ score: _, ...rest }) => rest);
    } catch {
      return [];
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
