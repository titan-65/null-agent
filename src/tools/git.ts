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
  description: "Show the working tree status. Shows staged, unstaged, and untracked files.",
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
  description: "Show commit history. Use 'count' to limit the number of commits shown.",
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
  description: "Show details of a specific commit or the latest commit.",
  parameters: {
    type: "object",
    properties: {
      ref: {
        type: "string",
        description: "The commit ref to show (e.g., 'HEAD', 'abc123'). Default: HEAD.",
      },
    },
  },
  async execute(params) {
    const ref = (params["ref"] as string) ?? "HEAD";
    return runGit(["show", "--stat", ref]);
  },
};

export const gitPushTool: ToolDefinition = {
  name: "git_push",
  description: "Push commits to a remote repository. Use 'remote' and 'branch' to specify the target.",
  parameters: {
    type: "object",
    properties: {
      remote: {
        type: "string",
        description: "The remote name. Default: 'origin'.",
      },
      branch: {
        type: "string",
        description: "The branch name. If not specified, pushes the current branch.",
      },
      setUpstream: {
        type: "boolean",
        description: "Set upstream branch for the current branch.",
      },
    },
  },
  async execute(params) {
    const remote = (params["remote"] as string) ?? "origin";
    const branch = params["branch"] as string | undefined;
    const setUpstream = params["setUpstream"] as boolean | undefined;

    const args = ["push"];
    if (setUpstream) args.push("-u");
    if (branch) args.push("-o", `push.default=current`);
    args.push(remote);
    if (branch) args.push(branch);

    return runGit(args);
  },
};

export const gitPullTool: ToolDefinition = {
  name: "git_pull",
  description: "Fetch and integrate changes from a remote repository.",
  parameters: {
    type: "object",
    properties: {
      remote: {
        type: "string",
        description: "The remote name. Default: 'origin'.",
      },
      branch: {
        type: "string",
        description: "The branch name to pull. If not specified, pulls the current branch.",
      },
      rebase: {
        type: "boolean",
        description: "Use rebase instead of merge when integrating changes.",
      },
    },
  },
  async execute(params) {
    const remote = (params["remote"] as string) ?? "origin";
    const branch = params["branch"] as string | undefined;
    const rebase = params["rebase"] as boolean | undefined;

    const args = ["pull"];
    if (rebase) args.push("--rebase");
    args.push(remote);
    if (branch) args.push(branch);

    return runGit(args);
  },
};

export const gitFetchTool: ToolDefinition = {
  name: "git_fetch",
  description: "Download objects and refs from another repository.",
  parameters: {
    type: "object",
    properties: {
      remote: {
        type: "string",
        description: "The remote name. Default: 'origin'.",
      },
      all: {
        type: "boolean",
        description: "Fetch all remotes.",
      },
      prune: {
        type: "boolean",
        description: "Remove remote-tracking branches that no longer exist.",
      },
    },
  },
  async execute(params) {
    const remote = (params["remote"] as string) | undefined;
    const all = params["all"] as boolean | undefined;
    const prune = params["prune"] as boolean | undefined;

    const args = ["fetch"];
    if (prune) args.push("--prune");
    if (all) args.push("--all");
    else if (remote) args.push(remote);

    return runGit(args);
  },
};

export const gitMergeTool: ToolDefinition = {
  name: "git_merge",
  description: "Join two or more development histories together.",
  parameters: {
    type: "object",
    properties: {
      branch: {
        type: "string",
        description: "The branch name to merge into the current branch.",
      },
      message: {
        type: "string",
        description: "A commit message for the merge commit.",
      },
      noFF: {
        type: "boolean",
        description: "Create a merge commit even if the merge resolves as a fast-forward.",
      },
    },
    required: ["branch"],
  },
  async execute(params) {
    const branch = params["branch"] as string;
    const message = params["message"] as string | undefined;
    const noFF = params["noFF"] as boolean | undefined;

    if (!branch) {
      return { content: "Error: 'branch' parameter is required.", isError: true };
    }

    const args = ["merge"];
    if (noFF) args.push("--no-ff");
    if (message) args.push("-m", message);
    args.push(branch);

    return runGit(args);
  },
};

export const gitRebaseTool: ToolDefinition = {
  name: "git_rebase",
  description: "Reapply commits on top of another base tip.",
  parameters: {
    type: "object",
    properties: {
      branch: {
        type: "string",
        description: "The branch to rebase onto. Default: 'main' or 'master'.",
      },
      interactive: {
        type: "boolean",
        description: "Use interactive rebase.",
      },
    },
  },
  async execute(params) {
    const branch = (params["branch"] as string) ?? "main";
    const interactive = params["interactive"] as boolean | undefined;

    const args = ["rebase"];
    if (interactive) args.push("-i");
    args.push(branch);

    return runGit(args);
  },
};

export const gitStashPushTool: ToolDefinition = {
  name: "git_stash_push",
  description: "Stash changes in a dirty working directory.",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "A stash message to describe the changes.",
      },
      includeUntracked: {
        type: "boolean",
        description: "Also stash untracked files.",
      },
    },
  },
  async execute(params) {
    const message = params["message"] as string | undefined;
    const includeUntracked = params["includeUntracked"] as boolean | undefined;

    const args = ["stash", "push"];
    if (message) args.push("-m", message);
    if (includeUntracked) args.push("-u");

    return runGit(args);
  },
};

export const gitStashPopTool: ToolDefinition = {
  name: "git_stash_pop",
  description: "Apply and remove the most recent stash.",
  parameters: {
    type: "object",
    properties: {
      stash: {
        type: "string",
        description: "The stash to apply (e.g., 'stash@{0}'). Default: most recent.",
      },
    },
  },
  async execute(params) {
    const stash = params["stash"] as string | undefined;
    const args = ["stash", "pop"];
    if (stash) args.push(stash);

    return runGit(args);
  },
};

export const gitStashListTool: ToolDefinition = {
  name: "git_stash_list",
  description: "List all stashed changesets.",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute() {
    return runGit(["stash", "list"]);
  },
};

export const gitStashDropTool: ToolDefinition = {
  name: "git_stash_drop",
  description: "Discard a stash from the stash list.",
  parameters: {
    type: "object",
    properties: {
      stash: {
        type: "string",
        description: "The stash to drop (e.g., 'stash@{0}').",
      },
    },
    required: ["stash"],
  },
  async execute(params) {
    const stash = params["stash"] as string;
    if (!stash) {
      return { content: "Error: 'stash' parameter is required.", isError: true };
    }
    return runGit(["stash", "drop", stash]);
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
  gitPushTool,
  gitPullTool,
  gitFetchTool,
  gitMergeTool,
  gitRebaseTool,
  gitStashPushTool,
  gitStashPopTool,
  gitStashListTool,
  gitStashDropTool,
];
