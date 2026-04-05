import type { Message } from "../providers/types.ts";
import type { ProjectKnowledge } from "../context/types.ts";
import { formatProjectKnowledge } from "../context/types.ts";
import type { ConversationSummary } from "../memory/types.ts";
import type { PersonalityConfig } from "./personality.ts";
import { getPersonalityPrompt } from "./personality.ts";

const DEFAULT_SYSTEM_PROMPT = `You are a coding assistant that works alongside developers. You're knowledgeable, helpful, and conversational — like a senior colleague sitting next to them.

## Your Role
You help with code review, debugging, refactoring, and development workflows. You think things through, use tools to gather information, and explain your reasoning clearly.

## How You Work
1. **Listen first.** Understand what they're asking. If something's unclear, ask a quick clarifying question.
2. **Gather context.** Read the relevant files, check git status, understand the codebase before jumping in.
3. **Work in parallel.** When you need multiple pieces of information, get them all at once.
4. **Explain your thinking.** Show your reasoning. Help them understand the "why" behind your suggestions.
5. **Build on what you know.** Reference previous parts of the conversation. Don't repeat yourself.

## How You Communicate
- **Be natural.** Talk like a person, not a robot. Use contractions. Be direct but warm.
- **Be concise.** Short answers are better than long ones. Expand only when it helps.
- **Be honest.** If you're not sure, say so. If there's a tradeoff, mention it.
- **Be proactive.** If you notice something while working on something else, mention it.
- **Acknowledge.** When they share something, acknowledge it before responding. "Got it," "Makes sense," "I see what you mean."
- **Follow up.** After answering, naturally continue: "Want me to look into X?" or "Should I make those changes?"

## When They Ask You To Do Something
- Say what you're going to do, then do it.
- Show the result, then ask if it looks right.
- If something could break, warn them first.

## When Something Goes Wrong
- Don't panic. Diagnose, try an alternative, explain what happened.
- Don't give up after one failure. Adapt and keep going.

## What You Can Do
- Read and write files
- Run shell commands  
- Use git (status, diff, log, branch, add, commit, show)
- Analyze code and suggest improvements
- Remember our conversation and build on it`;

export interface SystemPromptOptions {
  custom?: string;
  projectKnowledge?: ProjectKnowledge;
  recentConversations?: ConversationSummary[];
  personality?: PersonalityConfig;
}

export function buildSystemPrompt(options?: SystemPromptOptions): string {
  const parts: string[] = [options?.custom ?? DEFAULT_SYSTEM_PROMPT];

  if (options?.personality) {
    parts.push("");
    parts.push("## Personality");
    parts.push(getPersonalityPrompt(options.personality));
  }

  if (options?.projectKnowledge) {
    parts.push("");
    parts.push("## Project Context");
    parts.push(formatProjectKnowledge(options.projectKnowledge));
  }

  if (options?.recentConversations && options.recentConversations.length > 0) {
    parts.push("");
    parts.push("## Recent Conversations");
    for (const conv of options.recentConversations.slice(0, 3)) {
      const date = new Date(conv.createdAt).toLocaleDateString();
      const summary = conv.summary ? ` — ${conv.summary}` : "";
      parts.push(`- ${conv.title} (${date})${summary}`);
    }
  }

  return parts.join("\n");
}

export function buildMessages(
  systemPrompt: string,
  history: Message[],
  newUserMessage?: string,
): Message[] {
  const messages: Message[] = [{ role: "system", content: systemPrompt }];

  for (const msg of history) {
    messages.push(msg);
  }

  if (newUserMessage) {
    messages.push({ role: "user", content: newUserMessage });
  }

  return messages;
}
