import type { ReviewComment, ReviewSeverity } from "./types.ts";

interface PerformancePattern {
  pattern: RegExp;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
}

const PERFORMANCE_PATTERNS: PerformancePattern[] = [
  // N+1 query pattern
  {
    pattern: /for\s*\([^)]*\)\s*\{[^}]*\.(find|query|get|fetch|select)/gs,
    severity: "critical",
    message: "Potential N+1 query pattern. Database calls inside loops.",
    suggestion: "Use batch queries or JOINs instead of querying inside loops.",
  },
  // Large array operations
  {
    pattern: /\.(map|filter|reduce|forEach)\s*\([^)]*\)\s*\.\s*(map|filter|reduce|forEach)/g,
    severity: "warning",
    message: "Chained array methods create intermediate arrays. Consider a single loop.",
    suggestion: "Use a single for loop or reduce() to avoid creating intermediate arrays.",
  },
  // Synchronous operations
  {
    pattern: /readFileSync|writeFileSync|execSync|spawnSync/g,
    severity: "warning",
    message: "Synchronous file/process operation blocks the event loop.",
    suggestion: "Use async versions (readFile, writeFile, exec) instead.",
  },
  // Large JSON parsing
  {
    pattern: /JSON\.parse\s*\(\s*(?:fs\.readFileSync|require)/g,
    severity: "info",
    message: "Large JSON file parsed synchronously. Consider streaming.",
    suggestion: "Use JSONStream or streaming parser for large files.",
  },
  // Regex without limits
  {
    pattern: /new\s+RegExp\s*\(\s*["'`].*\*.*\)/g,
    severity: "warning",
    message: "Regex with unbounded quantifier may cause ReDoS.",
    suggestion: "Add limits to quantifiers or use a safer regex pattern.",
  },
  // Missing pagination
  {
    pattern: /\.find\s*\(\s*\)\s*\.\s*toArray\s*\(\)/g,
    severity: "warning",
    message: "Unbounded database query. May return large result sets.",
    suggestion: "Add pagination with limit() and skip() or cursor-based pagination.",
  },
  // Missing debounce/throttle
  {
    pattern: /addEventListener\s*\(\s*['"](scroll|resize|mousemove|input|keyup|keydown)['"]/g,
    severity: "info",
    message: "High-frequency event listener without debounce/throttle.",
    suggestion: "Add debounce or throttle to reduce handler calls.",
  },
  // Large bundle indicators
  {
    pattern: /import\s*\*\s+as\s+\w+\s+from/g,
    severity: "info",
    message: "Importing entire module. Consider named imports for tree-shaking.",
    suggestion: "Import only what you need: import { specificFunction } from 'module'.",
  },
  // Unoptimized images
  {
    pattern: /\.(png|jpg|jpeg|gif|bmp|tiff)['"`]/gi,
    severity: "info",
    message: "Unoptimized image format detected.",
    suggestion: "Use WebP or AVIF for better compression.",
  },
  // Multiple awaits in sequence
  {
    pattern: /await\s+\w+\s*\([^)]*\)\s*;[\s\n]*await\s+\w+\s*\([^)]*\)/g,
    severity: "info",
    message: "Sequential awaits could be parallelized with Promise.all().",
    suggestion: "If operations are independent, use Promise.all() for parallelism.",
  },
];

export function analyzePerformance(code: string, file: string): ReviewComment[] {
  const comments: ReviewComment[] = [];

  for (const pattern of PERFORMANCE_PATTERNS) {
    const match = pattern.pattern.exec(code);
    if (match) {
      const lineNum = code.slice(0, match.index).split("\n").length;
      comments.push({
        id: `perf-${lineNum}-${pattern.severity}`,
        category: "performance",
        severity: pattern.severity,
        file,
        line: lineNum,
        code: match[0].slice(0, 80),
        message: pattern.message,
        suggestion: pattern.suggestion,
      });
    }
  }

  // Check for missing indexes
  if (file.match(/\.sql$/i)) {
    if (code.includes("WHERE") && !code.includes("INDEX") && !code.includes("CREATE INDEX")) {
      comments.push({
        id: "perf-index",
        category: "performance",
        severity: "warning",
        file,
        message: "Query with WHERE clause but no visible index.",
        suggestion: "Ensure columns in WHERE clause are indexed for better performance.",
      });
    }
  }

  // Check for missing React.memo
  if (
    file.match(/\.tsx?$/) &&
    code.includes("function") &&
    code.includes("return") &&
    code.includes("<")
  ) {
    if (!code.includes("React.memo") && !code.includes("memo(") && !code.includes("useMemo")) {
      comments.push({
        id: "perf-memo",
        category: "performance",
        severity: "info",
        file,
        message: "React component without memoization.",
        suggestion: "Consider React.memo() or useMemo() if component re-renders frequently.",
      });
    }
  }

  return comments;
}
