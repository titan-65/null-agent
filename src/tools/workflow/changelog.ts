import type { ToolDefinition } from "../types.ts";
import { runGit } from "./utils.ts";

interface ConventionalCommit {
  type: string;
  scope: string | null;
  description: string;
  breaking: boolean;
  hash: string;
}

export const changelogTool: ToolDefinition = {
  name: "changelog",
  description:
    "Generate a changelog from git commits. Groups commits by type (feat, fix, etc.) and formats as markdown. Useful for release notes.",
  parameters: {
    type: "object",
    properties: {
      since: {
        type: "string",
        description:
          "Generate changelog since this ref (tag, commit, or date). Defaults to last tag.",
      },
      format: {
        type: "string",
        enum: ["markdown", "plain"],
        description: "Output format. Default: markdown.",
      },
    },
  },
  async execute(params) {
    const since = params["since"] as string | undefined;
    const format = (params["format"] as string) ?? "markdown";

    // Find the base ref
    let baseRef = since;
    if (!baseRef) {
      const tagResult = await runGit("describe --tags --abbrev=0 2>/dev/null");
      if (!tagResult.isError && tagResult.content) {
        baseRef = tagResult.content;
      }
    }

    // Get commits
    const logArgs = baseRef
      ? `log ${baseRef}..HEAD --oneline --no-merges`
      : "log --oneline --no-merges -50";

    const logResult = await runGit(logArgs);
    if (logResult.isError) {
      return logResult;
    }

    if (!logResult.content) {
      return { content: "No commits found." };
    }

    const commits = parseCommits(logResult.content);
    const grouped = groupCommits(commits);

    if (format === "markdown") {
      return { content: formatMarkdown(grouped, baseRef) };
    }

    return { content: formatPlain(grouped) };
  },
};

export const commitSmartTool: ToolDefinition = {
  name: "commit_smart",
  description:
    "Analyze staged changes and suggest a conventional commit message. Shows the diff stats and suggests an appropriate commit type and description.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["suggest", "commit"],
        description:
          "'suggest' to just show the suggested message, 'commit' to actually commit with that message.",
      },
      message: {
        type: "string",
        description: "Override the suggested commit message (only used with action='commit').",
      },
    },
  },
  async execute(params) {
    const action = (params["action"] as string) ?? "suggest";
    const override = params["message"] as string | undefined;

    // Check staged changes
    const diffResult = await runGit("diff --staged --stat");
    if (diffResult.isError || !diffResult.content) {
      return {
        content: "No staged changes found. Use `git add <files>` to stage changes first.",
        isError: true,
      };
    }

    // Get the actual diff for analysis
    const diffContent = await runGit("diff --staged --name-status");
    const files = diffContent.content.split("\n").filter(Boolean);

    const suggested = suggestCommitMessage(files, diffResult.content);

    if (action === "suggest") {
      return {
        content: `Staged changes:\n${diffResult.content}\n\nSuggested commit message:\n  ${suggested}\n\nUse action: "commit" to commit with this message, or provide a custom message.`,
      };
    }

    // Commit
    const message = override ?? suggested;
    const commitResult = await runGit(`commit -m '${message.replace(/'/g, "'\\''")}'`);
    return commitResult;
  },
};

function parseCommits(log: string): ConventionalCommit[] {
  return log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const hash = line.slice(0, 7);
      const rest = line.slice(8);

      // Parse conventional commit format: type(scope): description
      const match = rest.match(/^(\w+)(?:\(([^)]*)\))?(!)?\s*:\s*(.+)$/);

      if (match) {
        return {
          type: match[1]!.toLowerCase(),
          scope: match[2] ?? null,
          description: match[4]!,
          breaking: !!match[3],
          hash,
        };
      }

      return {
        type: "other",
        scope: null,
        description: rest,
        breaking: false,
        hash,
      };
    });
}

function groupCommits(commits: ConventionalCommit[]): Map<string, ConventionalCommit[]> {
  const groups = new Map<string, ConventionalCommit[]>();

  const typeOrder = ["feat", "fix", "perf", "refactor", "docs", "test", "chore", "ci", "other"];

  for (const commit of commits) {
    const key = commit.type;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(commit);
  }

  // Sort groups by type order
  const sorted = new Map<string, ConventionalCommit[]>();
  for (const type of typeOrder) {
    if (groups.has(type)) {
      sorted.set(type, groups.get(type)!);
    }
  }

  return sorted;
}

function formatMarkdown(groups: Map<string, ConventionalCommit[]>, since?: string): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];

  lines.push(`# Changelog`);
  lines.push("");
  if (since) {
    lines.push(`## ${date} (since ${since})`);
  } else {
    lines.push(`## ${date}`);
  }
  lines.push("");

  const typeLabels: Record<string, string> = {
    feat: "Features",
    fix: "Bug Fixes",
    perf: "Performance",
    refactor: "Refactoring",
    docs: "Documentation",
    test: "Tests",
    chore: "Chores",
    ci: "CI/CD",
    other: "Other",
  };

  const breaking: string[] = [];

  for (const [type, commits] of groups) {
    const label = typeLabels[type] ?? type;
    lines.push(`### ${label}`);
    lines.push("");

    for (const commit of commits) {
      const scope = commit.scope ? `**${commit.scope}:** ` : "";
      lines.push(`- ${scope}${commit.description} (${commit.hash})`);

      if (commit.breaking) {
        breaking.push(`- ${scope}${commit.description} (${commit.hash})`);
      }
    }

    lines.push("");
  }

  if (breaking.length > 0) {
    lines.push("### BREAKING CHANGES");
    lines.push("");
    for (const b of breaking) {
      lines.push(b);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatPlain(groups: Map<string, ConventionalCommit[]>): string {
  const lines: string[] = [];

  for (const [type, commits] of groups) {
    lines.push(`${type.toUpperCase()}:`);
    for (const commit of commits) {
      const scope = commit.scope ? `(${commit.scope}) ` : "";
      lines.push(`  - ${scope}${commit.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function suggestCommitMessage(files: string[], _diffStats: string): string {
  // Analyze file changes to suggest commit type
  let type = "chore";
  let scope: string | null = null;

  const fileNames = files.map((f) => f.split("\t").pop() ?? f);
  const changeTypes = new Set(files.map((f) => f[0]));

  // Determine type from changes
  if (fileNames.some((f) => f.includes("test") || f.includes("spec"))) {
    type = "test";
  } else if (fileNames.some((f) => f.endsWith(".md") || f.includes("doc"))) {
    type = "docs";
  } else if (changeTypes.has("A")) {
    type = "feat";
  } else if (changeTypes.has("M")) {
    type = "fix";
  }

  // Determine scope from common path
  if (fileNames.length === 1) {
    const parts = fileNames[0]!.split("/");
    if (parts.length > 1) {
      scope = parts[parts.length - 2] ?? null;
    }
  } else {
    // Find common directory
    const dirs = fileNames.map((f) => {
      const parts = f.split("/");
      return parts.length > 1 ? parts[parts.length - 2] : null;
    });
    const uniqueDirs = [...new Set(dirs.filter(Boolean))];
    if (uniqueDirs.length === 1) {
      scope = uniqueDirs[0];
    }
  }

  // Generate description
  const fileCount = fileNames.length;
  let description: string;

  if (fileCount === 1) {
    description = `update ${fileNames[0]!.split("/").pop()}`;
  } else {
    description = `update ${fileCount} files`;
  }

  // Build commit message
  if (scope) {
    return `${type}(${scope}): ${description}`;
  }
  return `${type}: ${description}`;
}
