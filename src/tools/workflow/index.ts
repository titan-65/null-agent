export { changelogTool, commitSmartTool } from "./changelog.ts";
export { prCreateTool, prListTool } from "./pr.ts";
export { issueCreateTool, issueListTool } from "./issue.ts";
export { ciStatusTool, releasePrepareTool } from "./release.ts";

import type { ToolDefinition } from "../types.ts";
import { changelogTool, commitSmartTool } from "./changelog.ts";
import { prCreateTool, prListTool } from "./pr.ts";
import { issueCreateTool, issueListTool } from "./issue.ts";
import { ciStatusTool, releasePrepareTool } from "./release.ts";

export const workflowTools: ToolDefinition[] = [
  changelogTool,
  commitSmartTool,
  prCreateTool,
  prListTool,
  issueCreateTool,
  issueListTool,
  ciStatusTool,
  releasePrepareTool,
];
