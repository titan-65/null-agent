import type { ReviewComment, ReviewSeverity } from "./types.ts";

interface QualityPattern {
  pattern: RegExp;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
}

const QUALITY_PATTERNS: QualityPattern[] = [
  // Long functions
  {
    pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{500,}\}/g,
    severity: "warning",
    message: "Function is too long (>500 chars). Consider breaking it into smaller functions.",
    suggestion: "Extract logical chunks into separate functions with clear names.",
  },
  // Deep nesting
  {
    pattern: /^\s{12,}/gm,
    severity: "warning",
    message: "Deeply nested code. Consider early returns or extracting functions.",
    suggestion: "Use guard clauses and early returns to reduce nesting.",
  },
  // Magic numbers
  {
    pattern: /[^a-zA-Z_](?:if|while|for|return|===|!==|>|<|>=|<=)\s*\d{3,}/g,
    severity: "info",
    message: "Magic number detected. Use named constants.",
    suggestion: "Extract to a named constant: const MAX_RETRIES = 3;",
  },
  // Any type
  {
    pattern: /:\s*any\b/g,
    severity: "warning",
    message: "Using 'any' type defeats TypeScript's type safety.",
    suggestion: "Use a specific type, unknown, or generics instead.",
  },
  // Console statements in production code
  {
    pattern: /console\.(log|warn|error|debug|info)\s*\(/g,
    severity: "info",
    message: "Console statement found. Consider using a proper logging library.",
    suggestion: "Use a logging library like winston or pino for production.",
  },
  // Empty catch blocks
  {
    pattern: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g,
    severity: "critical",
    message: "Empty catch block swallows errors silently.",
    suggestion: "Log the error or handle it appropriately.",
  },
  // var instead of let/const
  {
    pattern: /\bvar\s+\w+/g,
    severity: "info",
    message: "Using 'var'. Prefer 'const' or 'let' for block scoping.",
    suggestion: "Replace 'var' with 'const' (or 'let' if reassignment is needed).",
  },
  // Multiple return statements
  {
    pattern: /return\s+[^;]+;\s*\n\s*return\s+/g,
    severity: "info",
    message: "Multiple return paths. Consider simplifying.",
    suggestion: "Consolidate return logic or use a single exit point.",
  },
  // Missing error handling
  {
    pattern: /async\s+\w+\s*\([^)]*\)\s*\{(?![\s\S]*catch)/gs,
    severity: "warning",
    message: "Async function without error handling.",
    suggestion: "Add try/catch or ensure errors are handled by the caller.",
  },
  // Duplicated code patterns
  {
    pattern: /(const|let|var)\s+\w+\s*=\s*[^;]+;\s*\n\s*\1\s+\w+\s*=\s*[^;]+;/g,
    severity: "info",
    message: "Similar variable declarations. Consider using an array or object.",
    suggestion: "Group related values in an array or object for easier management.",
  },
];

export function analyzeQuality(code: string, file: string): ReviewComment[] {
  const comments: ReviewComment[] = [];

  for (const pattern of QUALITY_PATTERNS) {
    const match = pattern.pattern.exec(code);
    if (match) {
      const lineNum = code.slice(0, match.index).split("\n").length;
      comments.push({
        id: `quality-${lineNum}-${pattern.severity}`,
        category: "quality",
        severity: pattern.severity,
        file,
        line: lineNum,
        code: match[0].slice(0, 80),
        message: pattern.message,
        suggestion: pattern.suggestion,
      });
    }
  }

  // Cyclomatic complexity estimation
  const complexity = estimateComplexity(code);
  if (complexity > 10) {
    comments.push({
      id: "quality-complexity",
      category: "quality",
      severity: complexity > 20 ? "critical" : "warning",
      file,
      message: `High cyclomatic complexity (${complexity}). Consider simplifying.`,
      suggestion: "Break into smaller functions, use strategy pattern, or reduce branching.",
    });
  }

  // Check for missing tests
  if (!file.includes("test") && !file.includes("spec") && !file.includes("__tests__")) {
    const testFile = file.replace(/\.(ts|js)x?$/, ".test.$1");
    comments.push({
      id: "quality-tests",
      category: "testing",
      severity: "info",
      file,
      message: "No corresponding test file found.",
      suggestion: `Consider creating ${testFile} with unit tests.`,
    });
  }

  return comments;
}

function estimateComplexity(code: string): number {
  let complexity = 1;

  // Count decision points
  const decisionPoints = code.match(/\b(if|else if|case|catch|&&|\|\?|for|while)\b/g);
  if (decisionPoints) {
    complexity += decisionPoints.length;
  }

  // Count ternary operators
  const ternaries = code.match(/\?[^?]*:/g);
  if (ternaries) {
    complexity += ternaries.length;
  }

  return complexity;
}
