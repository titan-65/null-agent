import type { Message } from "../providers/types.ts";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata: ConversationMetadata;
}

export interface ConversationMetadata {
  projectDir: string;
  projectName: string;
  provider: string;
  model: string;
  messageCount: number;
  summary?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary?: string;
}
