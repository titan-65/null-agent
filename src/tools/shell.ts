import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.ts";

const execAsync = promisify(exec);

export const shellTool: ToolDefinition = {
  name: "shell",
  description: "Run a shell command and return its stdout and stderr.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute.",
      },
    },
    required: ["command"],
  },
  async execute(params) {
    const command = params["command"] as string;
    if (!command) {
      return {
        content: "Error: 'command' parameter is required.",
        isError: true,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += `\n[stderr]\n${stderr}`;

      return { content: output || "(no output)" };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message: string };
      let output = `Command failed: ${execError.message}`;
      if (execError.stdout) output += `\n${execError.stdout}`;
      if (execError.stderr) output += `\n[stderr]\n${execError.stderr}`;
      return { content: output, isError: true };
    }
  },
};
