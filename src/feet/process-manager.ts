import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface ManagedProcess {
  id: string;
  name: string;
  command: string;
  cwd: string;
  pid: number;
  startedAt: number;
  status: "running" | "stopped" | "exited";
  exitCode?: number;
}

export interface StartOptions {
  command: string;
  name?: string;
  cwd?: string;
}

export interface StopResult {
  success: boolean;
  signal?: string;
}

let _instance: ProcessManager | null = null;

export function getProcessManager(): ProcessManager {
  if (!_instance) {
    _instance = new ProcessManager();
  }
  return _instance;
}

export function resetProcessManager(): void {
  _instance = null;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private childProcesses = new Map<string, ChildProcess>();

  async start(options: StartOptions): Promise<ManagedProcess> {
    const id = randomUUID();
    const name = options.name || `process-${id.slice(0, 8)}`;

    const child = spawn(options.command, [], {
      shell: true,
      cwd: options.cwd || process.cwd(),
      detached: false,
    });

    const proc: ManagedProcess = {
      id,
      name,
      command: options.command,
      cwd: options.cwd || process.cwd(),
      pid: child.pid!,
      startedAt: Date.now(),
      status: "running",
    };

    this.processes.set(id, proc);
    this.childProcesses.set(id, child);

    child.on("exit", (code) => {
      const p = this.processes.get(id);
      if (p) {
        p.status = "exited";
        p.exitCode = code ?? undefined;
      }
      this.childProcesses.delete(id);
    });

    child.on("error", () => {
      const p = this.processes.get(id);
      if (p) {
        p.status = "exited";
      }
      this.childProcesses.delete(id);
    });

    return proc;
  }

  list(): ManagedProcess[] {
    return Array.from(this.processes.values());
  }

  async stop(id: string, force = false): Promise<StopResult> {
    const child = this.childProcesses.get(id);
    const proc = this.processes.get(id);

    if (!child || !proc) {
      return { success: false };
    }

    const signal = force ? "SIGKILL" : "SIGTERM";

    try {
      process.kill(child.pid!, signal);
      proc.status = "stopped";
      this.childProcesses.delete(id);
      return { success: true, signal };
    } catch {
      return { success: false };
    }
  }

  getLogs(_id: string): string {
    return "";
  }
}
