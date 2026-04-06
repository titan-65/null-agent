import type { ToolDefinition } from "./types.ts";
import {
  generateTests,
  writeTestFile,
  runTests,
  analyzeTestFailures,
  getCoverage,
} from "../testing/index.ts";

export const generateTestTool: ToolDefinition = {
  name: "generate_tests",
  description:
    "Generate unit tests for a source file. Analyzes the code structure and creates comprehensive tests including edge cases, error handling, and mocking.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Source file to generate tests for.",
      },
      framework: {
        type: "string",
        enum: ["vitest", "jest", "mocha", "ava"],
        description: "Test framework to use. Auto-detected if not specified.",
      },
      includeEdgeCases: {
        type: "boolean",
        description: "Include edge case tests. Default: true.",
      },
      includeMocking: {
        type: "boolean",
        description: "Include mock tests. Default: true.",
      },
      write: {
        type: "boolean",
        description: "Write the test file to disk. Default: true.",
      },
    },
    required: ["file"],
  },
  async execute(params) {
    const file = params["file"] as string;
    const framework = params["framework"] as "vitest" | "jest" | "mocha" | "ava" | undefined;
    const includeEdgeCases = params["includeEdgeCases"] as boolean | undefined;
    const includeMocking = params["includeMocking"] as boolean | undefined;
    const shouldWrite = params["write"] !== false;

    try {
      const testFile = await generateTests(file, process.cwd(), {
        framework,
        includeEdgeCases,
        includeMocking,
      });

      let outputPath = "";
      if (shouldWrite) {
        outputPath = await writeTestFile(testFile);
      }

      return {
        content: `Generated ${testFile.framework} tests for ${file}\n\n${outputPath ? `Written to: ${outputPath}\n\n` : ""}${testFile.content}`,
      };
    } catch (error) {
      return {
        content: `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

export const runTestTool: ToolDefinition = {
  name: "run_tests",
  description: "Run tests and return results. Can run all tests or specific files.",
  parameters: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: { type: "string" },
        description: "Specific test files to run. If empty, runs all tests.",
      },
    },
  },
  async execute(params) {
    const files = params["files"] as string[] | undefined;

    try {
      const results = await runTests(files);
      const output = results.map((r) => r.output).join("\n");
      return { content: output };
    } catch (error) {
      return {
        content: `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

export const fixTestTool: ToolDefinition = {
  name: "fix_tests",
  description:
    "Analyze test failures and suggest fixes. Run after tests fail to get actionable feedback.",
  parameters: {
    type: "object",
    properties: {
      output: {
        type: "string",
        description: "Test output to analyze. If not provided, runs tests first.",
      },
    },
  },
  async execute(params) {
    let output = params["output"] as string | undefined;

    if (!output) {
      const results = await runTests();
      output = results[0]?.output ?? "";
    }

    try {
      const analysis = await analyzeTestFailures(output);

      if (analysis.failures.length === 0) {
        return { content: "No test failures found. All tests passing!" };
      }

      const lines = [
        `Found ${analysis.failures.length} failing test(s):`,
        "",
        ...analysis.failures.map((f, i) => `${i + 1}. ${f}`),
        "",
        "Suggestions:",
        ...analysis.suggestions.map((s, i) => `${i + 1}. ${s}`),
      ];

      return { content: lines.join("\n") };
    } catch (error) {
      return {
        content: `Failed to analyze tests: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

export const coverageTool: ToolDefinition = {
  name: "test_coverage",
  description: "Analyze test coverage for the project. Shows line, branch, and function coverage.",
  parameters: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Specific file to check coverage for. If not provided, checks all.",
      },
    },
  },
  async execute(params) {
    const _file = params["file"] as string | undefined;

    try {
      const coverage = await getCoverage();

      if (coverage.length === 0) {
        return {
          content: "No coverage data available. Run tests with --coverage flag first.",
        };
      }

      const totalLines = coverage.reduce((sum, c) => sum + c.lines, 0);
      const coveredLines = coverage.reduce((sum, c) => sum + c.covered, 0);
      const percentage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;

      const lines = [
        `Test Coverage: ${percentage}%`,
        "",
        `Lines: ${coveredLines}/${totalLines}`,
        "",
        "By file:",
        ...coverage.map((c) => `  ${c.file}: ${c.percentage}% (${c.covered}/${c.lines} lines)`),
      ];

      return { content: lines.join("\n") };
    } catch (error) {
      return {
        content: `Failed to get coverage: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

export const testingTools: ToolDefinition[] = [
  generateTestTool,
  runTestTool,
  fixTestTool,
  coverageTool,
];
