import { exec } from "node:child_process";
import { promisify } from "node:util";
import { basename } from "node:path";

const execAsync = promisify(exec);

export interface ProjectContext {
  cwd: string;
  projectName: string;
  gitBranch?: string;
  gitStatus?: string;
  hasChanges?: boolean;
  packageManager?: string;
}

async function runGit(args: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`git ${args}`, { timeout: 5000 });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function detectProjectContext(): Promise<ProjectContext> {
  const cwd = process.cwd();
  const projectName = basename(cwd);

  const [gitBranch, gitStatus, packageManager] = await Promise.all([
    runGit("branch --show-current"),
    runGit("status --porcelain"),
    detectPackageManager(),
  ]);

  return {
    cwd,
    projectName,
    gitBranch,
    gitStatus: gitStatus ?? undefined,
    hasChanges: gitStatus ? gitStatus.length > 0 : undefined,
    packageManager,
  };
}

async function detectPackageManager(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync("cat package.json 2>/dev/null", {
      timeout: 2000,
    });
    const pkg = JSON.parse(stdout) as { packageManager?: string };
    return pkg.packageManager;
  } catch {
    return undefined;
  }
}

export function formatContextSummary(ctx: ProjectContext): string {
  const parts: string[] = [ctx.projectName];
  if (ctx.gitBranch) parts.push(`git:${ctx.gitBranch}`);
  if (ctx.hasChanges) parts.push("modified");
  return parts.join(" · ");
}
