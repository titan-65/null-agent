import { resolve } from "node:path";
import { glob } from "tinyglobby";
import type { ToolDefinition } from "./types.ts";
import { String, Object, Optional, Array, toolParams } from "./schema.ts";

const DEFAULT_IGNORE = ["node_modules/**", ".git/**"];

export const fileGlobTool: ToolDefinition = {
  name: "file_glob",
  description: "Find files matching a glob pattern. Returns array of matching file paths.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern (e.g., **/*.ts)" },
      rootBoundary: { type: "string", description: "Root boundary for path validation" },
      options: {
        type: "object",
        properties: {
          ignore: { type: "array", items: { type: "string" } },
          limit: { type: "number" },
        },
      },
    },
    required: ["pattern"],
  },
  typeboxSchema: toolParams(
    {
      pattern: String({ description: "Glob pattern (e.g., **/*.ts)" }),
      rootBoundary: Optional(String({ description: "Root boundary for path validation" })),
      options: Optional(
        Object(
          {
            ignore: Array(String()),
            limit: Number(),
          },
          ["ignore", "limit"],
        ),
      ),
    },
    ["pattern"],
  ),
  async execute(params) {
    const pattern = params["pattern"] as string;
    const rootBoundary = (params["rootBoundary"] as string) || process.cwd();
    const options = (params["options"] as { ignore?: string[]; limit?: number }) || {};

    if (!pattern) {
      return { content: "Error: 'pattern' is required", isError: true };
    }

    try {
      const resolvedBoundary = resolve(rootBoundary);
      const ignorePatterns = [...DEFAULT_IGNORE, ...(options.ignore || [])];

      const files = await glob(pattern, {
        cwd: resolvedBoundary,
        ignore: ignorePatterns,
        absolute: true,
        onlyFiles: true,
      });

      const filtered = files
        .filter((f) => f.startsWith(resolvedBoundary + "/"))
        .slice(0, options.limit);

      return { content: JSON.stringify(filtered) };
    } catch (error) {
      return {
        content: `Error globbing: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
