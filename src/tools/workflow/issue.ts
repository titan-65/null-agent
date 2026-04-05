import type { ToolDefinition } from "../types.ts";
import { runGh, checkGhAvailable } from "./utils.ts";

export const issueCreateTool: ToolDefinition = {
  name: "issue_create",
  description: "Create a GitHub Issue. Supports title, body, labels, and assignees.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Issue title.",
      },
      body: {
        type: "string",
        description: "Issue description.",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to add (e.g., 'bug', 'enhancement').",
      },
      assignees: {
        type: "array",
        items: { type: "string" },
        description: "GitHub usernames to assign.",
      },
    },
    required: ["title"],
  },
  async execute(params) {
    const hasGh = await checkGhAvailable();
    if (!hasGh) {
      return {
        content: "Error: gh CLI not found. Install it from https://cli.github.com/",
        isError: true,
      };
    }

    const title = params["title"] as string;
    if (!title) {
      return { content: "Error: 'title' is required.", isError: true };
    }

    let cmd = `issue create --title '${title.replace(/'/g, "'\\''")}'`;

    if (params["body"]) {
      cmd += ` --body '${(params["body"] as string).replace(/'/g, "'\\''")}'`;
    }

    if (params["labels"]) {
      cmd += ` --label '${(params["labels"] as string[]).join(",")}'`;
    }

    if (params["assignees"]) {
      cmd += ` --assignee '${(params["assignees"] as string[]).join(",")}'`;
    }

    return runGh(cmd);
  },
};

export const issueListTool: ToolDefinition = {
  name: "issue_list",
  description: "List GitHub Issues. Filter by state, label, or assignee.",
  parameters: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["open", "closed", "all"],
        description: "Filter by state. Default: open.",
      },
      label: {
        type: "string",
        description: "Filter by label.",
      },
      assignee: {
        type: "string",
        description: "Filter by assignee. Use '@me' for yourself.",
      },
      limit: {
        type: "number",
        description: "Max issues to show. Default: 10.",
      },
    },
  },
  async execute(params) {
    const hasGh = await checkGhAvailable();
    if (!hasGh) {
      return {
        content: "Error: gh CLI not found.",
        isError: true,
      };
    }

    let cmd = "issue list";
    cmd += ` --state ${params["state"] ?? "open"}`;
    cmd += ` --limit ${params["limit"] ?? 10}`;

    if (params["label"]) {
      cmd += ` --label '${params["label"]}'`;
    }

    if (params["assignee"]) {
      cmd += ` --assignee '${params["assignee"]}'`;
    }

    return runGh(cmd);
  },
};
