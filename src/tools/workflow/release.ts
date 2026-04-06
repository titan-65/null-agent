import type { ToolDefinition } from "../types.ts";
import { runGh, runGit, checkGhAvailable } from "./utils.ts";

export const ciStatusTool: ToolDefinition = {
  name: "ci_status",
  description:
    "Check CI/CD status for the current branch. Shows GitHub Actions run status.",
  parameters: {
    type: "object",
    properties: {
      branch: {
        type: "string",
        description: "Branch to check. Defaults to current branch.",
      },
      limit: {
        type: "number",
        description: "Max runs to show. Default: 5.",
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

    const ghArgs = ["run", "list", "--limit", String((params["limit"] as number) ?? 5)];
    if (params["branch"]) {
      ghArgs.push("--branch", params["branch"] as string);
    }

    return runGh(ghArgs);
  },
};

export const releasePrepareTool: ToolDefinition = {
  name: "release_prepare",
  description:
    "Prepare a release: bump version, generate release notes from commits, create a tag.",
  parameters: {
    type: "object",
    properties: {
      bump: {
        type: "string",
        enum: ["patch", "minor", "major"],
        description: "Version bump type. Default: patch.",
      },
      tag: {
        type: "boolean",
        description: "Create a git tag. Default: true.",
      },
      push: {
        type: "boolean",
        description: "Push the tag to remote. Default: false.",
      },
    },
  },
  async execute(params) {
    const bump = (params["bump"] as string) ?? "patch";
    const shouldTag = params["tag"] !== false;
    const shouldPush = params["push"] === true;

    // Read current version from package.json
    const pkgResult = await runGit(["show", "HEAD:package.json"]);
    if (pkgResult.isError) {
      return pkgResult;
    }

    let currentVersion = "0.0.0";
    try {
      const pkg = JSON.parse(pkgResult.content) as { version?: string };
      currentVersion = pkg.version ?? "0.0.0";
    } catch {
      return { content: "Error: Could not parse package.json", isError: true };
    }

    // Bump version
    const [major, minor, patch] = currentVersion.split(".").map(Number);
    let newVersion: string;

    switch (bump) {
      case "major":
        newVersion = `${(major ?? 0) + 1}.0.0`;
        break;
      case "minor":
        newVersion = `${major}.${(minor ?? 0) + 1}.0`;
        break;
      default:
        newVersion = `${major}.${minor}.${(patch ?? 0) + 1}`;
    }

    // Generate release notes from commits since last tag
    const tagResult = await runGit(["describe", "--tags", "--abbrev=0"]);
    const lastTag = tagResult.isError ? "" : tagResult.content;

    const logArgs = lastTag
      ? ["log", `${lastTag}..HEAD`, "--oneline", "--no-merges"]
      : ["log", "--oneline", "--no-merges", "-20"];

    const commitsResult = await runGit(logArgs);

    let notes = `## Release v${newVersion}\n\n`;
    if (commitsResult.content) {
      const lines = commitsResult.content.split("\n").filter(Boolean);

      const features = lines.filter((l) => l.includes("feat"));
      const fixes = lines.filter((l) => l.includes("fix"));
      const other = lines.filter((l) => !l.includes("feat") && !l.includes("fix"));

      if (features.length) {
        notes += "### Features\n\n";
        for (const f of features) notes += `- ${f}\n`;
        notes += "\n";
      }

      if (fixes.length) {
        notes += "### Bug Fixes\n\n";
        for (const f of fixes) notes += `- ${f}\n`;
        notes += "\n";
      }

      if (other.length) {
        notes += "### Other\n\n";
        for (const f of other) notes += `- ${f}\n`;
        notes += "\n";
      }
    }

    // Create tag if requested
    if (shouldTag) {
      const tagCreateResult = await runGit([
        "tag", "-a", `v${newVersion}`, "-m", `Release v${newVersion}`,
      ]);
      if (tagCreateResult.isError) {
        return {
          content: `Version bump: ${currentVersion} → ${newVersion}\n\nRelease notes:\n${notes}\n\nError creating tag: ${tagCreateResult.content}`,
          isError: true,
        };
      }

      if (shouldPush) {
        await runGit(["push", "origin", `v${newVersion}`]);
      }
    }

    return {
      content: `Version bump: ${currentVersion} → ${newVersion}\n\nRelease notes:\n${notes}${shouldTag ? `Tag v${newVersion} created.${shouldPush ? " Pushed to remote." : ""}` : ""}`,
    };
  },
};
