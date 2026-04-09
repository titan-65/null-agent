import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";

export interface TerminalSession {
  id: string;
  name: string;
  createdAt: number;
  cwd: string;
  isActive: boolean;
}

export interface CreateOptions {
  name?: string;
  cwd?: string;
}

export class SessionManager {
  private sessions = new Map<string, TerminalSession>();
  private processes = new Map<string, ChildProcess>();

  async create(options: CreateOptions = {}): Promise<TerminalSession> {
    const id = randomUUID();
    const name = options.name || `session-${id.slice(0, 8)}`;

    const session: TerminalSession = {
      id,
      name,
      createdAt: Date.now(),
      cwd: options.cwd || process.cwd(),
      isActive: true,
    };

    this.sessions.set(id, session);
    return session;
  }

  list(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  close(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.isActive = false;
    }
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill();
      this.processes.delete(id);
    }
  }

  async attach(id: string, command?: string): Promise<{ output: string; exitCode?: number }> {
    const session = this.sessions.get(id);
    if (!session || !session.isActive) {
      throw new Error(`Session ${id} not found or inactive`);
    }

    return new Promise((resolve) => {
      const child = spawn(command || "ls", [], {
        shell: true,
        cwd: session.cwd,
      });

      this.processes.set(id, child);

      let output = "";

      child.stdout?.on("data", (data) => {
        output += data.toString();
      });

      child.stderr?.on("data", (data) => {
        output += data.toString();
      });

      child.on("error", (err) => {
        resolve({ output: `Error: ${err.message}`, exitCode: 1 });
      });

      child.on("close", (code) => {
        this.processes.delete(id);
        resolve({ output, exitCode: code ?? undefined });
      });
    });
  }
}
