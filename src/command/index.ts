import { readFile } from "node:fs/promises";

export interface Command {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  execute(): Promise<CommandResult>;
  undo(): Promise<void>;
  canUndo(): boolean;
}

export interface CommandResult {
  content: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export interface CommandHistory {
  commands: Command[];
  undoStack: Command[];
}

export class CommandManager {
  private history: Command[] = [];
  private undoStack: Command[] = [];

  async execute(command: Command): Promise<CommandResult> {
    const result = await command.execute();

    if (!result.isError) {
      this.history.push(command);
      this.undoStack = []; // Clear redo stack on new execution
    }

    return result;
  }

  async undo(): Promise<CommandResult | null> {
    const command = this.history.pop();
    if (!command || !command.canUndo()) return null;

    try {
      await command.undo();
      this.undoStack.push(command);
      return {
        content: `Undid: ${command.tool}`,
        isError: false,
      };
    } catch (error) {
      // Put it back if undo failed
      this.history.push(command);
      return {
        content: `Undo failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  async redo(): Promise<CommandResult | null> {
    const command = this.undoStack.pop();
    if (!command) return null;

    const result = await command.execute();
    if (!result.isError) {
      this.history.push(command);
    }
    return result;
  }

  getHistory(): Command[] {
    return [...this.history];
  }

  canUndo(): boolean {
    return this.history.length > 0 && this.history[this.history.length - 1]?.canUndo() === true;
  }

  canRedo(): boolean {
    return this.undoStack.length > 0;
  }

  clear(): void {
    this.history = [];
    this.undoStack = [];
  }
}

// Command factory for tool execution
export function createToolCommand(
  tool: string,
  args: Record<string, unknown>,
  executeFn: (tool: string, args: Record<string, unknown>) => Promise<CommandResult>,
): Command {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let snapshot: string | null = null;

  return {
    id,
    tool,
    arguments: args,
    async execute() {
      // Take snapshot for undo
      if (tool === "file_write" && args["path"]) {
        try {
          snapshot = await readFile(args["path"] as string, "utf-8");
        } catch {
          snapshot = null; // File doesn't exist yet
        }
      }

      return executeFn(tool, args);
    },
    async undo() {
      if (tool === "file_write" && args["path"] && snapshot !== null) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(args["path"] as string, snapshot, "utf-8");
      }
      // Shell commands and git operations can't be undone
    },
    canUndo() {
      return tool === "file_write" || tool === "file_delete";
    },
  };
}
