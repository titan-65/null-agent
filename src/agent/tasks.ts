export interface Task {
  id: string;
  description: string;
  status: "open" | "in_progress" | "done";
  createdAt: string;
  completedAt?: string;
  source?: string; // where the task was mentioned
}

export interface TaskList {
  tasks: Task[];
  updatedAt: string;
}

export function createTask(description: string, source?: string): Task {
  return {
    id: generateId(),
    description: cleanDescription(description),
    status: "open",
    createdAt: new Date().toISOString(),
    source,
  };
}

export function markTaskDone(task: Task): Task {
  return {
    ...task,
    status: "done",
    completedAt: new Date().toISOString(),
  };
}

export function extractTasks(text: string): string[] {
  const tasks: string[] = [];
  const patterns = [
    /(?:I need to|I should|I'll|I will|we need to|we should|let's|we should)\s+(.+?)(?:\.|$)/gi,
    /(?:TODO|FIXME|HACK|BUG):\s*(.+?)(?:\.|$)/gi,
    /(?:next step|next up|after this):\s*(.+?)(?:\.|$)/gi,
    /(?:you should|you could|you might want to)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const task = match[1]?.trim();
      if (task && task.length > 5 && task.length < 200) {
        tasks.push(task);
      }
    }
  }

  return tasks;
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks tracked.";

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  const lines: string[] = [];

  if (open.length > 0) {
    lines.push("## Open Tasks");
    for (const task of open) {
      const icon = task.status === "in_progress" ? "◐" : "○";
      lines.push(`${icon} [${task.id}] ${task.description}`);
    }
  }

  if (done.length > 0) {
    lines.push("");
    lines.push(`## Completed (${done.length})`);
    for (const task of done.slice(-5)) {
      lines.push(`✓ [${task.id}] ${task.description}`);
    }
  }

  if (open.length > 0) {
    lines.push("");
    lines.push("Use `/done <id>` to mark a task complete");
  }

  return lines.join("\n");
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/^(?:then|also|and)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateId(): string {
  return Date.now().toString(36).slice(-6);
}
