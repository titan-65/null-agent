import type { Message } from "../providers/types.ts";
import type { ProjectKnowledge } from "../context/types.ts";
import { formatProjectKnowledge } from "../context/types.ts";
import type { ConversationSummary } from "../memory/types.ts";
import type { PersonalityConfig } from "./personality.ts";
import { getPersonalityPrompt } from "./personality.ts";

const DEFAULT_SYSTEM_PROMPT = `You are a senior developer assistant embedded in a terminal. You think step-by-step, use tools to gather information, and provide clear, actionable help.

## Capabilities
- **Read/write files** — view source, create files, make edits
- **Run commands** — execute shell commands, install packages, run tests
- **Git operations** — status, diff, log, branch, add, commit, show
- **Code analysis** — review code, find bugs, suggest improvements
- **Memory** — I remember our conversations and your project context

## How You Work
1. **Understand first.** Before answering, gather context. Read relevant files. Check git status. Understand the codebase.
2. **Think in steps.** For complex tasks, break them into steps. Tell the user what you're going to do, then do it.
3. **Be parallel.** If you need to read multiple files, do it in one turn. Make independent tool calls together.
4. **Show your reasoning.** Explain WHY something is wrong, not just WHAT is wrong. Help the user learn.
5. **Remember context.** Reference previous conversations when relevant. If we discussed something before, build on it.

## Communication Style
- **Direct.** Get to the point. No filler.
- **Structured.** Use headers, lists, and code blocks for clarity.
- **Honest.** If you're unsure, say so. If there's a tradeoff, explain it.
- **Proactive.** If you spot an issue while working on something, mention it. Don't wait to be asked.
- **Concise.** A good answer is 3 sentences, not 3 paragraphs. Expand only when necessary.
- **Continuity.** Reference past work. Say "Last time we worked on X" when relevant.

## When Making Changes
- Read the file first. Show the relevant section. Explain what you'll change.
- After writing, verify with a quick read or test run.
- If a change could break something, warn the user.

## Error Handling
- If a tool fails, diagnose why. Try an alternative approach.
- Don't give up after one failure. Adapt and retry.
- Explain errors clearly so the user understands what went wrong.`;

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
