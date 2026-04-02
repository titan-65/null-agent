import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AwarenessEvent } from "./types.ts";

const execAsync = promisify(exec);

export interface GitState {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  conflicts: string[];
  ahead: number;
  behind: number;
}

export class GitMonitor {
  private projectDir: string;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastState: GitState | null = null;
  private callback: ((event: AwarenessEvent) => void) | null = null;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  start(callback: (event: AwarenessEvent) => void, pollIntervalMs: number): void {
    this.callback = callback;
    this.interval = setInterval(() => this.poll(), pollIntervalMs);
    // Initial poll
    this.poll();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const state = await this.getState();
      if (!state) return;

      if (this.lastState) {
        this.detectChanges(this.lastState, state);
      }

      this.lastState = state;
    } catch {
      // Git not available or not a git repo
    }
  }

  async getState(): Promise<GitState | null> {
    try {
      const [branch, status, aheadBehind] = await Promise.all([
        this.runGit("branch --show-current"),
        this.runGit("status --porcelain"),
        this.runGit("rev-list --left-right --count HEAD...@{upstream}").catch(() => "0\t0"),
      ]);

      if (branch === null) return null;

      const modified: string[] = [];
      const staged: string[] = [];
      const untracked: string[] = [];
      const conflicts: string[] = [];

      for (const line of status.split("\n")) {
        if (!line.trim()) continue;
        const index = line[0] ?? "";
        const worktree = line[1] ?? "";
        const file = line.slice(3);

        if (index === "U" || worktree === "U") {
          conflicts.push(file);
        } else if (index === "?") {
          untracked.push(file);
        } else {
          if (index !== " " && index !== "?") staged.push(file);
          if (worktree !== " " && worktree !== "?") modified.push(file);
        }
      }

      const [aheadStr, behindStr] = aheadBehind.split("\t");

      return {
        branch,
        modified,
        staged,
        untracked,
        conflicts,
        ahead: parseInt(aheadStr ?? "0", 10),
        behind: parseInt(behindStr ?? "0", 10),
      };
    } catch {
      return null;
    }
  }

  private detectChanges(prev: GitState, curr: GitState): void {
    if (!this.callback) return;

    // Branch change
    if (prev.branch !== curr.branch) {
      this.callback({
        type: "git:branch",
        message: curr.branch,
        timestamp: Date.now(),
      });
    }

    // New conflicts
    const newConflicts = curr.conflicts.filter((f) => !prev.conflicts.includes(f));
    if (newConflicts.length > 0) {
      this.callback({
        type: "git:conflict",
        message: `${newConflicts.length} file(s)`,
        timestamp: Date.now(),
        details: { files: newConflicts },
      });
    }

    // New or removed changes
    const prevTotal = prev.modified.length + prev.staged.length + prev.untracked.length;
    const currTotal = curr.modified.length + curr.staged.length + curr.untracked.length;

    if (currTotal > prevTotal) {
      const newFiles =
        curr.modified.length + curr.staged.length + curr.untracked.length - prevTotal;
      this.callback({
        type: "git:change",
        message: `${newFiles} new change(s) — ${curr.modified.length} modified, ${curr.staged.length} staged, ${curr.untracked.length} untracked`,
        timestamp: Date.now(),
        details: {
          modified: curr.modified.length,
          staged: curr.staged.length,
          untracked: curr.untracked.length,
        },
      });
    } else if (currTotal < prevTotal && currTotal > 0) {
      this.callback({
        type: "git:change",
        message: `changes resolved — ${currTotal} remaining`,
        timestamp: Date.now(),
      });
    }
  }

  private async runGit(args: string): Promise<string> {
    const { stdout } = await execAsync(`git ${args}`, {
      cwd: this.projectDir,
      timeout: 5000,
    });
    return stdout.trim();
  }
}
