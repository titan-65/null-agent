import type {
  ReviewComment,
  ReviewResult,
  ReviewConfig,
  ReviewCategory,
  CategoryScore,
} from "./types.ts";
import { calculateOverallScore } from "./types.ts";
import { analyzeSecurity } from "./security.ts";
import { analyzePerformance } from "./performance.ts";
import { analyzeQuality } from "./quality.ts";
import { runTests, analyzeTestFailures } from "../testing/index.ts";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const execAsync = promisify(exec);

export interface ReviewOptions {
  files?: string[];
  diff?: boolean;
  pr?: number;
  branch?: string;
  config?: Partial<ReviewConfig>;
}

import { DEFAULT_REVIEW_CONFIG } from "./types.ts";

export async function reviewCode(
  options: ReviewOptions = {},
  projectDir: string = process.cwd(),
): Promise<ReviewResult> {
  const startTime = Date.now();
  const config: ReviewConfig = {
    ...DEFAULT_REVIEW_CONFIG,
    ...options.config,
  };

  // Get files to review
  const files = await getFilesToReview(options, projectDir);

  // Analyze each file
  const allComments: ReviewComment[] = [];

  for (const file of files) {
    try {
      const content = await readFile(join(projectDir, file), "utf-8");
      const fileComments: ReviewComment[] = [];

      // Run all analyzers
      if (config.categories?.includes("security") ?? true) {
        fileComments.push(...analyzeSecurity(content, file));
      }
      if (config.categories?.includes("performance") ?? true) {
        fileComments.push(...analyzePerformance(content, file));
      }
      if (config.categories?.includes("quality") ?? true) {
        fileComments.push(...analyzeQuality(content, file));
      }

      // AI-powered review for best practices and testing
      if (config.categories?.includes("best_practices") ?? true) {
        fileComments.push(...analyzeBestPractices(content, file));
      }

      allComments.push(...fileComments);
    } catch {
      // Skip files that can't be read
    }
  }

  // Limit comments
  const limitedComments = allComments.slice(0, config.maxComments ?? 50);

  // Run tests and check for failures
  if (config.categories?.includes("testing") ?? true) {
    try {
      const testResults = await runTests(undefined, projectDir);
      for (const result of testResults) {
        if (!result.passed) {
          const analysis = await analyzeTestFailures(result.output);
          for (const failure of analysis.failures) {
            limitedComments.push({
              id: `test-${Date.now()}`,
              category: "testing",
              severity: "warning",
              file: result.file,
              message: `Test failure: ${failure}`,
            });
          }
          for (const suggestion of analysis.suggestions) {
            limitedComments.push({
              id: `test-suggestion-${Date.now()}`,
              category: "testing",
              severity: "suggestion",
              file: result.file,
              message: `Test fix suggestion: ${suggestion}`,
            });
          }
        }
      }
    } catch {
      // Tests may not be configured, skip
    }
  }

  // Calculate scores
  const categories = calculateCategoryScores(limitedComments, config.categories ?? []);
  const overallScore = calculateOverallScore(categories);

  // Generate summary
  const summary = generateSummary(overallScore, categories, limitedComments);

  return {
    id: `review-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    platform: config.platform ?? "github",
    repository: await getRepoName(projectDir),
    prNumber: options.pr,
    branch: options.branch ?? (await getCurrentBranch(projectDir)),
    overallScore,
    categories,
    comments: limitedComments,
    summary,
    autoFixable: limitedComments.filter((c) => c.autoFix).length,
    criticalIssues: limitedComments.filter((c) => c.severity === "critical").length,
    duration: Date.now() - startTime,
  };
}

function calculateCategoryScores(
  comments: ReviewComment[],
  categories: ReviewCategory[],
): CategoryScore[] {
  const maxScores: Record<ReviewCategory, number> = {
    security: 100,
    performance: 100,
    quality: 100,
    testing: 100,
    best_practices: 100,
  };

  const severityPenalties: Record<string, number> = {
    critical: 20,
    warning: 10,
    info: 5,
    suggestion: 2,
  };

  return categories.map((category) => {
    const categoryComments = comments.filter((c) => c.category === category);
    let score = maxScores[category] ?? 100;

    for (const comment of categoryComments) {
      score -= severityPenalties[comment.severity] ?? 0;
    }

    return {
      category,
      score: Math.max(0, score),
      maxScore: maxScores[category] ?? 100,
      comments: categoryComments,
    };
  });
}

function generateSummary(
  overallScore: number,
  categories: CategoryScore[],
  comments: ReviewComment[],
): string {
  const parts: string[] = [];

  if (overallScore >= 90) {
    parts.push("Excellent code quality! 🎉");
  } else if (overallScore >= 70) {
    parts.push("Good code quality with room for improvement.");
  } else if (overallScore >= 50) {
    parts.push("Code needs attention before merging.");
  } else {
    parts.push("Significant issues found. Review recommended before merging.");
  }

  const critical = comments.filter((c) => c.severity === "critical").length;
  if (critical > 0) {
    parts.push(`${critical} critical issue(s) must be addressed.`);
  }

  const warnings = comments.filter((c) => c.severity === "warning").length;
  if (warnings > 0) {
    parts.push(`${warnings} warning(s) should be reviewed.`);
  }

  const weakest = categories.reduce((min, cat) => {
    const score = cat.maxScore > 0 ? cat.score / cat.maxScore : 1;
    const minScore = min.maxScore > 0 ? min.score / min.maxScore : 1;
    return score < minScore ? cat : min;
  });

  if (weakest && weakest.comments.length > 0) {
    parts.push(`Focus area: ${weakest.category} (${weakest.score}/${weakest.maxScore})`);
  }

  return parts.join(" ");
}

async function getFilesToReview(options: ReviewOptions, projectDir: string): Promise<string[]> {
  if (options.files) {
    return options.files;
  }

  if (options.diff) {
    const { stdout } = await execAsync("git diff --name-only --staged", {
      cwd: projectDir,
      timeout: 10000,
    });
    return stdout.trim().split("\n").filter(Boolean);
  }

  if (options.pr) {
    // Would use GitHub API to get PR files
    // For now, fall back to staged changes
    const { stdout } = await execAsync("git diff --name-only HEAD~1", {
      cwd: projectDir,
      timeout: 10000,
    });
    return stdout.trim().split("\n").filter(Boolean);
  }

  // Default: all tracked files
  const { stdout } = await execAsync("git ls-files", {
    cwd: projectDir,
    timeout: 10000,
  });

  return stdout
    .trim()
    .split("\n")
    .filter(
      (f) =>
        f.match(/\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/i) &&
        !f.includes("node_modules") &&
        !f.includes("dist") &&
        !f.includes("build"),
    );
}

function analyzeBestPractices(code: string, file: string): ReviewComment[] {
  const comments: ReviewComment[] = [];

  // Check for proper error handling
  if (file.match(/\.(ts|js)x?$/) && code.includes("throw") && !code.includes("try")) {
    comments.push({
      id: "bp-error",
      category: "best_practices",
      severity: "warning",
      file,
      message: "Throwing errors without try/catch context.",
      suggestion: "Ensure errors are caught and handled appropriately.",
    });
  }

  // Check for proper typing
  if (
    file.match(/\.tsx?$/) &&
    code.includes("function") &&
    !code.includes(":") &&
    !code.includes("=>")
  ) {
    if (!code.includes("function") || !code.match(/function\s+\w+\s*\([^)]*\)\s*:/)) {
      comments.push({
        id: "bp-typing",
        category: "best_practices",
        severity: "info",
        file,
        message: "Function missing return type annotation.",
        suggestion: "Add explicit return type for better type safety.",
      });
    }
  }

  return comments;
}

async function getRepoName(projectDir: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: projectDir,
      timeout: 5000,
    });
    const match = stdout.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function getCurrentBranch(projectDir: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: projectDir,
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return "unknown";
  }
}
