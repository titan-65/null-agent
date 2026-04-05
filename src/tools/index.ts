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
export {
  changelogTool,
  commitSmartTool,
  prCreateTool,
  prListTool,
  issueCreateTool,
  issueListTool,
  ciStatusTool,
  releasePrepareTool,
  workflowTools,
} from "./workflow/index.ts";

import { fileReadTool } from "./file-read.ts";
import { fileWriteTool } from "./file-write.ts";
import { shellTool } from "./shell.ts";
import { gitTools } from "./git.ts";
import { workflowTools } from "./workflow/index.ts";
import { ToolRegistry } from "./registry.ts";
import type { ToolDefinition } from "./types.ts";

export const builtinTools: ToolDefinition[] = [
  fileReadTool,
  fileWriteTool,
  shellTool,
  ...gitTools,
  ...workflowTools,
];

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(builtinTools);
  return registry;
}
