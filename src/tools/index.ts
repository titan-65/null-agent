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
  gitPushTool,
  gitPullTool,
  gitFetchTool,
  gitMergeTool,
  gitRebaseTool,
  gitStashPushTool,
  gitStashPopTool,
  gitStashListTool,
  gitStashDropTool,
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
export { webSearchTool, webFetchTool } from "./web.ts";
export { fileMoveTool } from "./file-move.ts";
export { fileCopyTool } from "./file-copy.ts";
export { fileDeleteTool } from "./file-delete.ts";
export { fileGlobTool } from "./file-glob.ts";
export { fileRestoreTool } from "./file-restore.ts";
export { fileBulkTool } from "./file-bulk.ts";
export { taskSprintTool } from "./task-sprint.ts";
export type { TrashEntry } from "./trash.ts";

import { fileReadTool } from "./file-read.ts";
import { fileWriteTool } from "./file-write.ts";
import { shellTool } from "./shell.ts";
import { gitTools } from "./git.ts";
import { workflowTools } from "./workflow/index.ts";
import { reviewTool } from "./review.ts";
import { generateTestTool, runTestTool, fixTestTool, coverageTool } from "./testing.ts";
import { webSearchTool, webFetchTool } from "./web.ts";
import { fileMoveTool } from "./file-move.ts";
import { fileCopyTool } from "./file-copy.ts";
import { fileDeleteTool } from "./file-delete.ts";
import { fileGlobTool } from "./file-glob.ts";
import { fileRestoreTool } from "./file-restore.ts";
import { fileBulkTool } from "./file-bulk.ts";
import { ToolRegistry } from "./registry.ts";
import type { ToolDefinition } from "./types.ts";

export const builtinTools: ToolDefinition[] = [
  fileReadTool,
  fileWriteTool,
  shellTool,
  ...gitTools,
  ...workflowTools,
  reviewTool,
  generateTestTool,
  runTestTool,
  fixTestTool,
  coverageTool,
  webSearchTool,
  webFetchTool,
  fileMoveTool,
  fileCopyTool,
  fileDeleteTool,
  fileGlobTool,
  fileRestoreTool,
  fileBulkTool,
];

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(builtinTools);
  return registry;
}
