import type { ActivityType } from "./types.ts";

const TOOL_ACTIVITY_MAP: Record<string, ActivityType> = {
  file_read: "coding",
  file_write: "coding",
  file_move: "coding",
  file_copy: "coding",
  file_delete: "coding",
  file_glob: "coding",
  shell: "coding",
  git_status: "review",
  git_diff: "review",
  git_add: "coding",
  git_commit: "coding",
  git_log: "review",
  git_branch: "planning",
  git_show: "review",
  task_sprint: "planning",
  script_detect: "coding",
  script_run: "coding",
  process_start: "coding",
  process_stop: "coding",
  process_list: "coding",
  session_create: "coding",
  session_attach: "coding",
  web_search: "other",
  web_fetch: "other",
  review: "review",
};

function inferShellActivity(command: string): ActivityType {
  const cmd = command.toLowerCase();
  if (/debug|inspect|debugger/.test(cmd)) return "debugging";
  if (/test|jest|vitest|mocha|pytest|unittest/.test(cmd)) return "testing";
  if (/log|console\.log|println/.test(cmd)) return "debugging";
  if (/build|compile|pack|bundle|webpack|rollup/.test(cmd)) return "coding";
  if (/deploy|release|publish/.test(cmd)) return "coding";
  if (/review|diff|status|git/.test(cmd)) return "review";
  if (/npm|yarn|pnpm|install|add|remove/.test(cmd)) return "coding";
  if (/eslint|prettier|lint|format/.test(cmd)) return "coding";
  return "coding";
}

export class ActivityInferencer {
  private lastToolCallTime: number = 0;
  private lastActivityType: ActivityType = "coding";

  inferActivity(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ): { type: ActivityType; description: string } {
    let type: ActivityType;
    let description = toolName;

    if (toolName === "shell" && typeof args["command"] === "string") {
      const command = args["command"];
      type = inferShellActivity(command);
      description = `shell: ${command.slice(0, 50)}`;
    } else {
      type = TOOL_ACTIVITY_MAP[toolName] || "other";
      description = toolName.replace(/_/g, " ");
    }

    if (result && typeof result === "string") {
      if (/error|failed|exception/i.test(result)) {
        description = `${description} (error)`;
      }
    }

    const now = Date.now();
    const timeSinceLastCall = now - this.lastToolCallTime;
    this.lastToolCallTime = now;

    if (timeSinceLastCall > 30 * 60 * 1000) {
      this.lastActivityType = type;
    }

    this.lastActivityType = type;
    return { type, description };
  }

  shouldGroupActivity(
    previousType: ActivityType,
    currentType: ActivityType,
    timeSinceLastCallMs: number,
    groupingMinutes: number,
  ): boolean {
    const groupingMs = groupingMinutes * 60 * 1000;
    return previousType === currentType && timeSinceLastCallMs < groupingMs;
  }

  detectIdle(currentTime: Date, lastActivityTime: Date, idleThresholdMinutes: number): boolean {
    const idleMs = currentTime.getTime() - lastActivityTime.getTime();
    const thresholdMs = idleThresholdMinutes * 60 * 1000;
    return idleMs > thresholdMs;
  }
}
