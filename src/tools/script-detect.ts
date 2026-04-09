import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";
import { detectScripts } from "../feet/script-detector.ts";

export const scriptDetectTool: ToolDefinition = {
  name: "script_detect",
  description: "Detect available scripts from package.json, Makefile, and other project files.",
  parameters: {
    type: "object",
    properties: {
      cwd: { type: "string", description: "Project directory to scan" },
    },
  },
  typeboxSchema: toolParams(
    {
      cwd: Optional(String({ description: "Project directory to scan" })),
    },
    [],
  ),
  async execute(params) {
    const cwd = (params["cwd"] as string) || process.cwd();

    try {
      const scripts = await detectScripts(cwd);
      return { content: JSON.stringify(scripts, null, 2) };
    } catch (error) {
      return {
        content: `Error detecting scripts: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
