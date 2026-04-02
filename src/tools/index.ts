export type { ToolDefinition, ToolResult } from "./types.ts";
export { ToolRegistry } from "./registry.ts";
export { fileReadTool } from "./file-read.ts";
export { fileWriteTool } from "./file-write.ts";
export { shellTool } from "./shell.ts";
export {
  gitAddTool,
  gitBranchTool,
  gitCommitTool,
  gitDiffTool,
  gitLogTool,
  gitShowTool,
  gitStatusTool,
  gitTools,
} from "./git.ts";

import { fileReadTool } from "./file-read.ts";
import { fileWriteTool } from "./file-write.ts";
import { shellTool } from "./shell.ts";
import { gitTools } from "./git.ts";
import { ToolRegistry } from "./registry.ts";
import type { ToolDefinition } from "./types.ts";

export const builtinTools: ToolDefinition[] = [fileReadTool, fileWriteTool, shellTool, ...gitTools];

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(builtinTools);
  return registry;
}
