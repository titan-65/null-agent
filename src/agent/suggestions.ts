import type { GitState } from "../awareness/git.ts";
import type { Task } from "../agent/tasks.ts";

export interface Suggestion {
  message: string;
  priority: "low" | "medium" | "high";
  category: "git" | "test" | "task" | "review" | "cleanup";
}

export function generateSuggestions(context: {
  git?: GitState;
  tasks?: Task[];
  lastToolUsed?: string;
  lastMessage?: string;
}): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Git-based suggestions
  if (context.git) {
    if (context.git.conflicts.length > 0) {
      suggestions.push({
        message: `You have ${context.git.conflicts.length} merge conflict(s). Want me to help resolve them?`,
        priority: "high",
        category: "git",
      });
    }

    if (context.git.modified.length > 3) {
      suggestions.push({
        message: `${context.git.modified.length} files modified — want me to review the changes before you commit?`,
        priority: "medium",
        category: "review",
      });
    }

    if (context.git.staged.length > 0 && context.git.modified.length === 0) {
      suggestions.push({
        message: "You have staged changes ready — shall I help write a commit message?",
        priority: "medium",
        category: "git",
      });
    }

    if (context.git.ahead > 3) {
      suggestions.push({
        message: `${context.git.ahead} commits ahead of remote — ready to push?`,
        priority: "low",
        category: "git",
      });
    }
  }

  // Task-based suggestions
  const openTasks = context.tasks?.filter((t) => t.status === "open") ?? [];
  if (openTasks.length > 3) {
    suggestions.push({
      message: `You have ${openTasks.length} open tasks — want to work through them?`,
      priority: "low",
      category: "task",
    });
  }

  // Post-tool suggestions
  if (context.lastToolUsed === "file_write") {
    suggestions.push({
      message: "File updated — want me to run the tests or check for lint errors?",
      priority: "medium",
      category: "test",
    });
  }

  if (context.lastToolUsed === "git_add") {
    suggestions.push({
      message: "Files staged — shall I help write a commit message?",
      priority: "medium",
      category: "git",
    });
  }

  return suggestions;
}

export function formatSuggestion(suggestion: Suggestion): string {
  const icons: Record<Suggestion["category"], string> = {
    git: "git",
    test: "test",
    task: "task",
    review: "review",
    cleanup: "clean",
  };

  return `${icons[suggestion.category]} ${suggestion.message}`;
}

export function getHighestPrioritySuggestion(suggestions: Suggestion[]): Suggestion | null {
  if (suggestions.length === 0) return null;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...suggestions].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  return sorted[0] ?? null;
}
