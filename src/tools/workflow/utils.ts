import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolResult } from "../types.ts";

const execFileAsync = promisify(execFile);

export async function runGh(args: string[]): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", args, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    let output = "";
    if (stdout) output += stdout.trim();
    if (stderr) output += `\n${stderr.trim()}`;

    return { content: output || "(no output)" };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    let output = err.message;
    if (err.stdout) output = err.stdout.trim();
    if (err.stderr) output += `\n${err.stderr.trim()}`;
    return { content: output, isError: true };
  }
}

export async function runGit(args: string[]): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });

    let output = "";
    if (stdout) output += stdout.trim();
    if (stderr) output += `\n${stderr.trim()}`;

    return { content: output || "(no output)" };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    let output = err.message;
    if (err.stdout) output = err.stdout.trim();
    if (err.stderr) output += `\n${err.stderr.trim()}`;
    return { content: output, isError: true };
  }
}

export async function checkGhAvailable(): Promise<boolean> {
  try {
    await execFileAsync("gh", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
