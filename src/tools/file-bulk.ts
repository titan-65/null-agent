import type { ToolDefinition } from "./types.ts";
import { String, Object, Optional, Array, Union, Literal, toolParams } from "./schema.ts";
import { fileCopyTool } from "./file-copy.ts";
import { fileMoveTool } from "./file-move.ts";
import { fileDeleteTool } from "./file-delete.ts";

type Operation =
  | { type: "move"; source: string; destination: string }
  | { type: "copy"; source: string; destination: string }
  | { type: "delete"; path: string };

const OperationSchema = Union([
  Object({ type: Literal("move"), source: String(), destination: String() }),
  Object({ type: Literal("copy"), source: String(), destination: String() }),
  Object({ type: Literal("delete"), path: String() }),
]);

export const fileBulkTool: ToolDefinition = {
  name: "file_bulk",
  description: "Execute multiple file operations in batch. Returns results array.",
  parameters: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        description: "Array of operations to execute",
        items: { type: "object" },
      },
      rootBoundary: { type: "string", description: "Root boundary for path validation" },
    },
    required: ["operations"],
  },
  typeboxSchema: toolParams(
    {
      operations: Array(OperationSchema),
      rootBoundary: Optional(String({ description: "Root boundary for path validation" })),
    },
    ["operations"],
  ),
  async execute(params) {
    const operations = params["operations"] as Operation[];
    const rootBoundary = (params["rootBoundary"] as string) || process.cwd();

    if (!operations || Object.prototype.toString.call(operations) !== "[object Array]") {
      return { content: "Error: 'operations' must be an array", isError: true };
    }

    const results: { operation: string; success: boolean; error?: string }[] = [];

    for (const op of operations) {
      try {
        let result: { content: string; isError?: boolean } = { content: "" };

        switch (op.type) {
          case "move":
            result = await fileMoveTool.execute({
              source: op.source,
              destination: op.destination,
              rootBoundary,
            });
            break;
          case "copy":
            result = await fileCopyTool.execute({
              source: op.source,
              destination: op.destination,
              rootBoundary,
            });
            break;
          case "delete":
            result = await fileDeleteTool.execute({ path: op.path, rootBoundary });
            break;
          default:
            result = {
              content: `Unknown operation type: ${(op as { type: string }).type}`,
              isError: true,
            };
        }

        results.push({
          operation: op.type,
          success: !result.isError,
          error: result.isError ? result.content : undefined,
        });
      } catch (error) {
        results.push({
          operation: op.type,
          success: false,
          error: error instanceof Error ? error.message : `${error}`,
        });
      }
    }

    return { content: JSON.stringify(results, null, 2) };
  },
};
