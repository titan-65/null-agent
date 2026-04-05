import type { ToolDefinition } from "./types.ts";
import { reviewCode, type ReviewOptions } from "../review/reviewer.ts";
import { formatReviewReport, DEFAULT_REVIEW_CONFIG } from "../review/types.ts";

export const reviewTool: ToolDefinition = {
  name: "code_review",
  description:
    "Perform a comprehensive code review. Analyzes security, performance, quality, testing, and best practices. Returns a scored report with actionable feedback.",
  parameters: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        enum: ["staged", "recent", "full", "file"],
        description:
          "Review scope: 'staged' (git staged files), 'recent' (last commit), 'full' (all tracked files), 'file' (specific file).",
      },
      file: {
        type: "string",
        description: "Specific file to review (used with scope='file').",
      },
      depth: {
        type: "string",
        enum: ["quick", "deep"],
        description: "Review depth. Quick is faster, deep is more thorough.",
      },
      categories: {
        type: "array",
        items: {
          type: "string",
          enum: ["security", "performance", "quality", "testing", "best_practices"],
        },
        description: "Categories to review. Default: all.",
      },
    },
  },
  async execute(params) {
    const scope = (params["scope"] as string) ?? "staged";
    const depth = (params["depth"] as string) ?? "deep";
    const categories = params["categories"] as string[] | undefined;

    const options: ReviewOptions = {
      config: {
        ...DEFAULT_REVIEW_CONFIG,
        depth: depth as "quick" | "deep",
        categories: categories
          ? (categories as Array<
              "security" | "performance" | "quality" | "testing" | "best_practices"
            >)
          : DEFAULT_REVIEW_CONFIG.categories,
      },
    };

    switch (scope) {
      case "staged":
        options.diff = true;
        break;
      case "recent":
        options.branch = "HEAD~1";
        break;
      case "full":
        // No options needed - reviews all tracked files
        break;
      case "file": {
        const file = params["file"] as string;
        if (!file) {
          return {
            content: "Error: 'file' parameter required when scope='file'.",
            isError: true,
          };
        }
        options.files = [file];
        break;
      }
      default:
        options.diff = true;
    }

    try {
      const result = await reviewCode(options);
      const report = formatReviewReport(result);

      return {
        content: report,
      };
    } catch (error) {
      return {
        content: `Review failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
