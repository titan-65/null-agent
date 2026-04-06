import type { ToolDefinition } from "../types.ts";
import { runGh, runGit, checkGhAvailable } from "./utils.ts";

export const prCreateTool: ToolDefinition = {
  name: "pr_create",
  description:
    "Create a GitHub Pull Request. Auto-generates description from commits if not provided. Requires gh CLI.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "PR title. If not provided, generates from branch name.",
      },
      body: {
        type: "string",
        description: "PR description. If not provided, generates from commits.",
      },
      base: {
        type: "string",
        description: "Target branch (default: main or master).",
      },
      draft: {
        type: "boolean",
        description: "Create as draft PR.",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to add.",
      },
      reviewers: {
        type: "array",
        items: { type: "string" },
        description: "GitHub usernames to request review from.",
      },
    },
  },
  async execute(params) {
    const hasGh = await checkGhAvailable();
    if (!hasGh) {
      return {
        content: "Error: gh CLI not found. Install it from https://cli.github.com/",
        isError: true,
      };
    }

    // Get branch info
    const branchResult = await runGit(["branch", "--show-current"]);
    const branch = branchResult.content || "unknown";

    // Generate title if not provided
    let title = params["title"] as string | undefined;
    if (!title) {
      title = branch.replace(/[-_/]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Generate body from commits if not provided
    let body = params["body"] as string | undefined;
    if (!body) {
      const commitsResult = await runGit(["log", "origin/main..HEAD", "--oneline", "--no-merges"]);
      if (!commitsResult.isError && commitsResult.content) {
        const lines = commitsResult.content.split("\n").filter(Boolean);
        body = "## Changes\n\n";
        for (const line of lines) {
          body += `- ${line}\n`;
        }
      }
    }

    // Build gh command args - no shell interpolation
    const ghArgs = ["pr", "create", "--title", title ?? ""];

    if (body) {
      ghArgs.push("--body", body);
    }
    if (params["base"]) {
      ghArgs.push("--base", params["base"] as string);
    }
    if (params["draft"]) {
      ghArgs.push("--draft");
    }
    if (params["labels"]) {
      ghArgs.push("--label", (params["labels"] as string[]).join(","));
    }
    if (params["reviewers"]) {
      ghArgs.push("--reviewer", (params["reviewers"] as string[]).join(","));
    }

    const result = await runGh(ghArgs);

    if (!result.isError) {
      return {
        content: `PR created successfully!\n\nBranch: ${branch}\nTitle: ${title}\n${result.content}`,
      };
    }

    return result;
  },
};

export const prListTool: ToolDefinition = {
  name: "pr_list",
  description: "List open GitHub Pull Requests. Shows status, reviewers, and CI checks.",
  parameters: {
    type: "object",
    properties: {
      author: {
        type: "string",
        description: "Filter by author.",
      },
      state: {
        type: "string",
        enum: ["open", "closed", "merged", "all"],
        description: "Filter by state. Default: open.",
      },
      limit: {
        type: "number",
        description: "Max number of PRs to show. Default: 10.",
      },
    },
  },
  async execute(params) {
    const hasGh = await checkGhAvailable();
    if (!hasGh) {
      return {
        content: "Error: gh CLI not found. Install it from https://cli.github.com/",
        isError: true,
      };
    }

    const ghArgs = [
      "pr", "list",
      "--state", (params["state"] as string) ?? "open",
      "--limit", String((params["limit"] as number) ?? 10),
    ];

    if (params["author"]) {
      ghArgs.push("--author", params["author"] as string);
    }

    return runGh(ghArgs);
  },
};
