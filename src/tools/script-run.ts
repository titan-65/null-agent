import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.ts";
import { String, Optional, toolParams } from "./schema.ts";

const execAsync = promisify(exec);

export const scriptRunTool: ToolDefinition = {
  name: "script_run",
  description: "Run a script or command with configurable output mode.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command or script name to run" },
      mode: { type: "string", enum: ["stream", "summary", "both"], description: "Output mode" },
      cwd: { type: "string", description: "Working directory" },
    },
    required: ["command"],
  },
  typeboxSchema: toolParams(
    {
      command: String({ description: "Command or script name to run" }),
      mode: Optional(String({ description: "Output mode: stream, summary, or both" })),
      cwd: Optional(String({ description: "Working directory" })),
    },
    ["command"],
  ),
  async execute(params) {
    const command = params["command"] as string;
    const cwd = (params["cwd"] as string) || process.cwd();

    if (!command) {
      return { content: "Error: 'command' is required", isError: true };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024,
        cwd,
      });

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += `\n[stderr]\n${stderr}`;

      return { content: output || "(no output)" };
    } catch (error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        message: string;
        code?: number;
      };
      let output = `Command failed: ${execError.message}`;
      if (execError.stdout) output += `\n${execError.stdout}`;
      if (execError.stderr) output += `\n[stderr]\n${execError.stderr}`;
      return { content: output, isError: true };
    }
  },
};
