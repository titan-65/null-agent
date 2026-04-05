export type ReviewCategory = "security" | "performance" | "quality" | "testing" | "best_practices";

export type ReviewSeverity = "critical" | "warning" | "info" | "suggestion";

export type ReviewPlatform = "github" | "gitlab" | "bitbucket";

export type ReviewDepth = "quick" | "deep";

export interface ReviewComment {
  id: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  file: string;
  line?: number;
  code?: string;
  message: string;
  suggestion?: string;
  autoFix?: string;
}

export interface CategoryScore {
  category: ReviewCategory;
  score: number;
  maxScore: number;
  comments: ReviewComment[];
}

export interface ReviewResult {
  id: string;
  timestamp: string;
  platform: ReviewPlatform;
  repository: string;
  prNumber?: number;
  branch?: string;
  commit?: string;
  overallScore: number;
  categories: CategoryScore[];
  comments: ReviewComment[];
  summary: string;
  autoFixable: number;
  criticalIssues: number;
  duration: number;
}

export interface ReviewConfig {
  platform: ReviewPlatform;
  depth: ReviewDepth;
  categories: ReviewCategory[];
  ignorePaths: string[];
  maxComments: number;
  tokenBudget?: number;
  standards?: Record<string, unknown>;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  platform: "github",
  depth: "deep",
  categories: ["security", "performance", "quality", "testing", "best_practices"],
  ignorePaths: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "*.min.css",
    "*.lock",
    "vendor/**",
  ],
  maxComments: 50,
};

export function calculateOverallScore(categories: CategoryScore[]): number {
  if (categories.length === 0) return 0;

  const weights: Record<ReviewCategory, number> = {
    security: 0.3,
    performance: 0.2,
    quality: 0.2,
    testing: 0.15,
    best_practices: 0.15,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const cat of categories) {
    const weight = weights[cat.category] ?? 0.1;
    const normalizedScore = cat.maxScore > 0 ? cat.score / cat.maxScore : 0;
    weightedScore += normalizedScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
}

export function formatReviewReport(result: ReviewResult): string {
  const lines: string[] = [];

  lines.push(`# Code Review Report`);
  lines.push("");
  lines.push(`**Repository:** ${result.repository}`);
  if (result.prNumber) lines.push(`**PR:** #${result.prNumber}`);
  if (result.branch) lines.push(`**Branch:** ${result.branch}`);
  lines.push(`**Date:** ${result.timestamp}`);
  lines.push(`**Duration:** ${Math.round(result.duration / 1000)}s`);
  lines.push("");

  // Overall score
  const scoreEmoji =
    result.overallScore >= 90
      ? "🟢"
      : result.overallScore >= 70
        ? "🟡"
        : result.overallScore >= 50
          ? "🟠"
          : "🔴";

  lines.push(`## Overall Score: ${scoreEmoji} ${result.overallScore}/100`);
  lines.push("");

  // Category scores
  lines.push(`## Category Breakdown`);
  lines.push("");
  for (const cat of result.categories) {
    const score = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
    const emoji = score >= 90 ? "✅" : score >= 70 ? "⚠️" : "❌";
    lines.push(`- ${emoji} **${cat.category}:** ${score}/100 (${cat.comments.length} issues)`);
  }
  lines.push("");

  // Summary
  lines.push(`## Summary`);
  lines.push("");
  lines.push(result.summary);
  lines.push("");

  // Critical issues
  const critical = result.comments.filter((c) => c.severity === "critical");
  if (critical.length > 0) {
    lines.push(`## Critical Issues (${critical.length})`);
    lines.push("");
    for (const issue of critical) {
      lines.push(`### ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      if (issue.code) lines.push(`\`\`\`${issue.category}\n${issue.code}\n\`\`\``);
      lines.push(issue.message);
      if (issue.suggestion) lines.push(`**Suggestion:** ${issue.suggestion}`);
      lines.push("");
    }
  }

  // All comments
  lines.push(`## All Comments (${result.comments.length})`);
  lines.push("");
  for (const comment of result.comments) {
    const severityIcon =
      comment.severity === "critical"
        ? "🔴"
        : comment.severity === "warning"
          ? "🟡"
          : comment.severity === "info"
            ? "🔵"
            : "💡";
    lines.push(
      `- ${severityIcon} **${comment.category}** ${comment.file}${comment.line ? `:${comment.line}` : ""}: ${comment.message}`,
    );
  }

  if (result.autoFixable > 0) {
    lines.push("");
    lines.push(`## Auto-Fixable Issues: ${result.autoFixable}`);
    lines.push("");
    lines.push(
      "Some issues can be automatically fixed. Run `null-agent review --fix` to apply fixes.",
    );
  }

  return lines.join("\n");
}
