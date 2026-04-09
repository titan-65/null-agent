import { rename, mkdir } from "node:fs/promises";
import { dirname, resolve, isAbsolute } from "node:path";
import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";

export const fileMoveTool: ToolDefinition = {
  name: "file_move",
  description: "Move a file from source to destination. Supports undo via trash.",
  parameters: {
    type: "object",
    properties: {
      source: { type: "string", description: "Source file path" },
      destination: { type: "string", description: "Destination file path" },
      rootBoundary: { type: "string", description: "Root boundary for path validation" },
    },
    required: ["source", "destination"],
  },
  typeboxSchema: toolParams(
    {
      source: String({ description: "Source file path" }),
      destination: String({ description: "Destination file path" }),
      rootBoundary: Optional(String({ description: "Root boundary for path validation" })),
    },
    ["source", "destination"],
  ),
  async execute(params) {
    const source = params["source"] as string;
    const destination = params["destination"] as string;
    const rootBoundary = (params["rootBoundary"] as string) || process.cwd();

    if (!source || !destination) {
      return { content: "Error: 'source' and 'destination' are required", isError: true };
    }

    try {
      const resolvedSource = isAbsolute(source) ? source : resolve(rootBoundary, source);
      const resolvedDest = isAbsolute(destination)
        ? destination
        : resolve(rootBoundary, destination);
      const resolvedBoundary = resolve(rootBoundary);

      const normalizedBoundary = resolvedBoundary + "/";
      if (
        !resolvedSource.startsWith(normalizedBoundary) ||
        !resolvedDest.startsWith(normalizedBoundary)
      ) {
        return { content: `Error: Path is outside root boundary ${rootBoundary}`, isError: true };
      }

      await mkdir(dirname(resolvedDest), { recursive: true });
      await rename(resolvedSource, resolvedDest);

      return { content: `Moved ${source} to ${destination}` };
    } catch (error) {
      return {
        content: `Error moving file: ${error instanceof Error ? error.message : error}`,
        isError: true,
      };
    }
  },
};
