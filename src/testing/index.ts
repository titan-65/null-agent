import { readFile, writeFile, mkdir, readFileSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface TestFile {
  path: string;
  content: string;
  framework: "vitest" | "jest" | "mocha" | "ava";
}

export interface TestResult {
  file: string;
  passed: boolean;
  output: string;
  duration: number;
}

export interface TestCoverage {
  file: string;
  lines: number;
  covered: number;
  branches: number;
  branchesCovered: number;
  functions: number;
  functionsCovered: number;
  percentage: number;
}

export interface TestGenerationOptions {
  framework?: "vitest" | "jest" | "mocha" | "ava";
  includeEdgeCases?: boolean;
  includeMocking?: boolean;
  maxTests?: number;
}

const DEFAULT_OPTIONS: TestGenerationOptions = {
  framework: "vitest",
  includeEdgeCases: true,
  includeMocking: true,
  maxTests: 10,
};

export async function generateTests(
  sourceFile: string,
  projectDir: string = process.cwd(),
  options: TestGenerationOptions = DEFAULT_OPTIONS,
): Promise<TestFile> {
  const content = await readFile(join(projectDir, sourceFile), "utf-8");
  const framework = options.framework ?? detectFramework(projectDir);
  const ext = extname(sourceFile);
  const baseName = basename(sourceFile, ext);
  const testFile = join(dirname(sourceFile), `${baseName}.test${ext}`);

  // Analyze the source file
  const analysis = analyzeSourceFile(content, sourceFile);

  // Generate test content
  const testContent = generateTestContent(analysis, framework, options);

  return {
    path: testFile,
    content: testContent,
    framework,
  };
}

export async function writeTestFile(
  testFile: TestFile,
  projectDir: string = process.cwd(),
): Promise<string> {
  const fullPath = join(projectDir, testFile.path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, testFile.content, "utf-8");
  return fullPath;
}

export async function runTests(
  files?: string[],
  projectDir: string = process.cwd(),
): Promise<TestResult[]> {
  const cmd = files?.length
    ? `npx vitest run ${files.join(" ")} --reporter=verbose 2>&1`
    : "npx vitest run --reporter=verbose 2>&1";

  try {
    const { stdout, stderr: _stderr } = await execAsync(cmd, {
      cwd: projectDir,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    return [
      {
        file: files?.join(", ") ?? "all",
        passed: true,
        output: stdout,
        duration: 0,
      },
    ];
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return [
      {
        file: files?.join(", ") ?? "all",
        passed: false,
        output: err.stdout ?? err.stderr ?? String(error),
        duration: 0,
      },
    ];
  }
}

export async function analyzeTestFailures(
  testOutput: string,
): Promise<{ failures: string[]; suggestions: string[] }> {
  const failures: string[] = [];
  const suggestions: string[] = [];

  // Parse test output for failures
  const lines = testOutput.split("\n");

  for (const line of lines) {
    if (line.includes("FAIL") || line.includes("×") || line.includes("AssertionError")) {
      failures.push(line.trim());
    }

    // Generate suggestions based on common failure patterns
    if (line.includes("TypeError") || line.includes("undefined")) {
      suggestions.push("Check for null/undefined values. Add null checks or optional chaining.");
    }
    if (line.includes("AssertionError") || line.includes("expected")) {
      suggestions.push("Review the expected vs actual values. The assertion may need updating.");
    }
    if (line.includes("timeout") || line.includes("timed out")) {
      suggestions.push("Increase timeout or optimize the async operation.");
    }
    if (line.includes("ENOENT") || line.includes("not found")) {
      suggestions.push("Ensure the file or module exists. Check import paths.");
    }
  }

  // Remove duplicate suggestions
  return {
    failures,
    suggestions: [...new Set(suggestions)],
  };
}

export async function getCoverage(projectDir: string = process.cwd()): Promise<TestCoverage[]> {
  try {
    const { stdout: _stdout } = await execAsync("npx vitest run --coverage --reporter=json 2>&1", {
      cwd: projectDir,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    // Parse coverage from JSON output
    const coverage: TestCoverage[] = [];
    return coverage;
  } catch {
    return [];
  }
}

interface SourceAnalysis {
  fileName: string;
  exports: string[];
  functions: Array<{ name: string; params: string[]; isAsync: boolean }>;
  classes: Array<{ name: string; methods: string[] }>;
  imports: string[];
  hasSideEffects: boolean;
}

function analyzeSourceFile(content: string, filePath: string): SourceAnalysis {
  const exports: string[] = [];
  const functions: Array<{ name: string; params: string[]; isAsync: boolean }> = [];
  const classes: Array<{ name: string; methods: string[] }> = [];
  const imports: string[] = [];

  // Find exports
  const exportMatches = content.matchAll(
    /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g,
  );
  for (const match of exportMatches) {
    exports.push(match[1]!);
  }

  // Find functions
  const funcMatches = content.matchAll(
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
  );
  for (const match of funcMatches) {
    functions.push({
      name: match[1]!,
      params: match[2]!
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      isAsync: match[0]!.includes("async"),
    });
  }

  // Find arrow functions
  const arrowMatches = content.matchAll(
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
  );
  for (const match of arrowMatches) {
    functions.push({
      name: match[1]!,
      params: match[2]!
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      isAsync: match[0]!.includes("async"),
    });
  }

  // Find classes
  const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)/g);
  for (const match of classMatches) {
    classes.push({
      name: match[1]!,
      methods: [],
    });
  }

  // Find imports
  const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    imports.push(match[1]!);
  }

  return {
    fileName: basename(filePath),
    exports,
    functions,
    classes,
    imports,
    hasSideEffects: content.includes("console.") || content.includes("process."),
  };
}

function generateTestContent(
  analysis: SourceAnalysis,
  framework: string,
  options: TestGenerationOptions,
): string {
  const lines: string[] = [];

  // Import statement
  if (framework === "vitest") {
    lines.push("import { describe, it, expect, vi, beforeEach } from 'vitest';");
  } else if (framework === "jest") {
    lines.push("import { describe, it, expect, jest, beforeEach } from '@jest/globals';");
  }

  lines.push(
    `import { ${analysis.exports.join(", ")} } from './${basename(analysis.fileName, extname(analysis.fileName))}';`,
  );
  lines.push("");

  // Generate tests for each function
  for (const func of analysis.functions) {
    lines.push(`describe('${func.name}', () => {`);

    // Basic test
    lines.push(`  it('should exist and be callable', () => {`);
    lines.push(`    expect(typeof ${func.name}).toBe('function');`);
    lines.push(`  });`);
    lines.push("");

    // Test with default params
    if (func.params.length > 0) {
      lines.push(`  it('should handle valid input', () => {`);
      const args = func.params.map((p) => {
        if (p.includes("string") || p.includes("name") || p.includes("path")) return '"test"';
        if (p.includes("number") || p.includes("count") || p.includes("size")) return "1";
        if (p.includes("boolean") || p.includes("enabled")) return "true";
        if (p.includes("array") || p.includes("list")) return "[]";
        if (p.includes("object") || p.includes("config")) return "{}";
        return "undefined";
      });
      lines.push(`    const result = ${func.name}(${args.join(", ")});`);
      lines.push(`    expect(result).toBeDefined();`);
      lines.push(`  });`);
      lines.push("");
    }

    // Edge cases
    if (options.includeEdgeCases) {
      lines.push(`  it('should handle empty input', () => {`);
      const emptyArgs = func.params.map((p) => {
        if (p.includes("string")) return '""';
        if (p.includes("number")) return "0";
        if (p.includes("array")) return "[]";
        if (p.includes("object")) return "{}";
        return "undefined";
      });
      lines.push(`    const result = ${func.name}(${emptyArgs.join(", ")});`);
      lines.push(`    expect(result).toBeDefined();`);
      lines.push(`  });`);
      lines.push("");

      if (func.params.length > 0) {
        lines.push(`  it('should handle null/undefined input', () => {`);
        const nullArgs = func.params.map(() => "undefined");
        lines.push(`    const result = ${func.name}(${nullArgs.join(", ")});`);
        lines.push(`    expect(result).toBeDefined();`);
        lines.push(`  });`);
        lines.push("");
      }
    }

    // Async tests
    if (func.isAsync) {
      lines.push(`  it('should handle async errors', async () => {`);
      lines.push(`    await expect(${func.name}()).rejects.toBeDefined();`);
      lines.push(`  });`);
      lines.push("");
    }

    lines.push(`});`);
    lines.push("");
  }

  // Generate tests for each class
  for (const cls of analysis.classes) {
    lines.push(`describe('${cls.name}', () => {`);
    lines.push(`  let instance: ${cls.name};`);
    lines.push("");
    lines.push(`  beforeEach(() => {`);
    lines.push(`    instance = new ${cls.name}();`);
    lines.push(`  });`);
    lines.push("");

    for (const method of cls.methods) {
      lines.push(`  it('${method} should work', () => {`);
      lines.push(`    expect(instance.${method}()).toBeDefined();`);
      lines.push(`  });`);
      lines.push("");
    }

    lines.push(`});`);
    lines.push("");
  }

  return lines.join("\n");
}

function detectFramework(projectDir: string): "vitest" | "jest" | "mocha" | "ava" {
  try {
    const pkgPath = join(projectDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps["vitest"] || allDeps["vite-plus"]) return "vitest";
    if (allDeps["jest"]) return "jest";
    if (allDeps["mocha"]) return "mocha";
    if (allDeps["ava"]) return "ava";
  } catch {
    // ignore
  }

  return "vitest";
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
}

export async function benchmark(
  fn: () => Promise<void> | void,
  options: { iterations?: number; warmup?: number } = {},
): Promise<BenchmarkResult> {
  const iterations = options.iterations ?? 100;
  const warmup = options.warmup ?? 10;

  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Benchmark
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
  const minTime = times[0]!;
  const maxTime = times[times.length - 1]!;
  const p95Time = times[Math.floor(iterations * 0.95)]!;
  const p99Time = times[Math.floor(iterations * 0.99)]!;

  return {
    name: fn.name || "anonymous",
    iterations,
    avgTime,
    minTime,
    maxTime,
    p95Time,
    p99Time,
  };
}

export function formatBenchmark(result: BenchmarkResult): string {
  return `Benchmark: ${result.name}
  Iterations: ${result.iterations}
  Avg: ${result.avgTime.toFixed(2)}ms
  Min: ${result.minTime.toFixed(2)}ms
  Max: ${result.maxTime.toFixed(2)}ms
  P95: ${result.p95Time.toFixed(2)}ms
  P99: ${result.p99Time.toFixed(2)}ms`;
}

export async function generateAITests(
  sourceFile: string,
  agent: any,
  projectDir: string = process.cwd(),
  options: TestGenerationOptions = DEFAULT_OPTIONS,
): Promise<TestFile> {
  const content = await readFile(join(projectDir, sourceFile), "utf-8");
  const framework = options.framework ?? detectFramework(projectDir);
  const ext = extname(sourceFile);
  const baseName = basename(sourceFile, ext);
  const testFile = join(dirname(sourceFile), `${baseName}.test${ext}`);

  const prompt = `Generate comprehensive ${framework} tests for this ${ext} file:

\`\`\`${ext.slice(1)}
${content}
\`\`\`

Requirements:
- Test all exported functions and classes
- Include edge cases (empty input, null/undefined, boundary values)
- Test error handling and async behavior
- Use describe/it blocks with clear descriptions
- Include mocking for external dependencies
- Maximum ${options.maxTests ?? 10} test cases

Return ONLY the test code, no explanations.`;

  const result = await agent.chat(prompt);

  // Extract code from the response
  let testContent = result.content;
  const codeMatch = testContent.match(/```[\w]*\n([\s\S]*?)```/);
  if (codeMatch) {
    testContent = codeMatch[1]!;
  }

  return {
    path: testFile,
    content: testContent,
    framework,
  };
}
