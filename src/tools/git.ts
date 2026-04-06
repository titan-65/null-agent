import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.ts";

const execFileAsync = promisify(execFile);

async function runGit(
  args: string[],
  cwd?: string,
): Promise<{ content: string; isError: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });

    let output = "";
    if (stdout) output += stdout.trim();
    if (stderr) output += `\n[stderr] ${stderr.trim()}`;

    return { content: output || "(no output)", isError: false };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    let output = err.message;
    if (err.stdout) output += `\n${err.stdout}`;
    if (err.stderr) output += `\n[stderr] ${err.stderr}`;
    return { content: output, isError: true };
  }
}

export const gitStatusTool: ToolDefinition = {
  name: "git_status",
  description:
    "Show the working tree status. Shows staged, unstaged, and untracked files.",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute() {
    return runGit(["status", "--short", "--branch"]);
  },
};

export const gitDiffTool: ToolDefinition = {
  name: "git_diff",
  description:
    "Show changes between working tree and index, or between commits. Use 'staged' to show staged changes.",
  parameters: {
    type: "object",
    properties: {
      staged: {
        type: "boolean",
        description: "Show staged changes instead of unstaged.",
      },
      path: {
        type: "string",
        description: "Limit diff to a specific file or directory path.",
      },
    },
  },
  async execute(params) {
    const staged = params["staged"] as boolean | undefined;
    const path = params["path"] as string | undefined;

    const args = ["diff"];
    if (staged) args.push("--staged");
    if (path) args.push("--", path);

    return runGit(args);
  },
};

export const gitLogTool: ToolDefinition = {
  name: "git_log",
  description:
    "Show commit history. Use 'count' to limit the number of commits shown.",
  parameters: {
    type: "object",
    properties: {
      count: {
        type: "number",
        description: "Number of commits to show. Default: 10.",
      },
      path: {
        type: "string",
        description: "Limit log to a specific file path.",
      },
    },
  },
  async execute(params) {
    const count = (params["count"] as number) ?? 10;
    const path = params["path"] as string | undefined;

    const args = ["log", "--oneline", "-n", String(count)];
    if (path) args.push("--", path);

    return runGit(args);
  },
};

export const gitBranchTool: ToolDefinition = {
  name: "git_branch",
  description: "List local branches. Use 'all' to include remote branches.",
  parameters: {
    type: "object",
    properties: {
      all: {
        type: "boolean",
        description: "Include remote-tracking branches.",
      },
    },
  },
  async execute(params) {
    const showAll = params["all"] as boolean | undefined;
    const args = ["branch"];
    if (showAll) args.push("-a");
    return runGit(args);
  },
};

export const gitAddTool: ToolDefinition = {
  name: "git_add",
  description:
    "Stage files for commit. Use 'path' to stage specific files, or '.' to stage all changes.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path or '.' to stage all changes.",
      },
    },
    required: ["path"],
  },
  async execute(params) {
    const path = params["path"] as string;
    if (!path) {
      return {
        content: "Error: 'path' parameter is required.",
        isError: true,
      };
    }
    return runGit(["add", "--", path]);
  },
};

export const gitCommitTool: ToolDefinition = {
  name: "git_commit",
  description: "Create a commit with the currently staged changes.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The commit message.",
      },
    },
    required: ["message"],
  },
  async execute(params) {
    const message = params["message"] as string;
    if (!message) {
      return {
        content: "Error: 'message' parameter is required.",
        isError: true,
      };
    }
    // execFile passes arguments safely - no shell escaping needed
    return runGit(["commit", "-m", message]);
  },
};

export const gitShowTool: ToolDefinition = {
  name: "git_show",
  description:
    "Show details of a specific commit or the latest commit.",
  parameters: {
    type: "object",
    properties: {
      ref: {
        type: "string",
        description:
          "The commit ref to show (e.g., 'HEAD', 'abc123'). Default: HEAD.",
      },
    },
  },
  async execute(params) {
    const ref = (params["ref"] as string) ?? "HEAD";
    return runGit(["show", "--stat", ref]);
  },
};

export const gitTools: ToolDefinition[] = [
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitBranchTool,
  gitAddTool,
  gitCommitTool,
  gitShowTool,
];
