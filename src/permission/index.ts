import type { PermissionConfig } from "../config/index.ts";

export type OperationType =
  | "file_read"
  | "file_write"
  | "file_delete"
  | "shell_exec"
  | "git_add"
  | "git_commit"
  | "git_push";

export interface PermissionRequest {
  id: string;
  operation: OperationType;
  tool: string;
  arguments: Record<string, unknown>;
  description: string;
  risk: "low" | "medium" | "high";
}

export type PermissionResolver = (request: PermissionRequest) => Promise<boolean>;

export class PermissionManager {
  private config: PermissionConfig;
  private resolver: PermissionResolver | null = null;
  private alwaysAllow = new Set<string>();

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  setResolver(resolver: PermissionResolver): void {
    this.resolver = resolver;
  }

  updateConfig(config: PermissionConfig): void {
    this.config = config;
  }

  allowAlways(key: string): void {
    this.alwaysAllow.add(key);
  }

  async check(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<{ allowed: boolean; requiresConfirmation: boolean }> {
    const operation = this.classifyOperation(tool, args);

    // Plan mode — deny all writes
    if (this.config.mode === "plan") {
      if (this.isDestructive(operation)) {
        return { allowed: false, requiresConfirmation: false };
      }
    }

    // Auto mode — allow everything
    if (this.config.mode === "auto") {
      return { allowed: true, requiresConfirmation: false };
    }

    // Check deny patterns
    if (this.matchesDenyPattern(tool, args)) {
      return { allowed: false, requiresConfirmation: false };
    }

    // Check always-allow
    const key = `${tool}:${JSON.stringify(args)}`;
    if (this.alwaysAllow.has(key)) {
      return { allowed: true, requiresConfirmation: false };
    }

    // Confirm mode — ask for destructive operations
    if (this.isDestructive(operation)) {
      return { allowed: true, requiresConfirmation: true };
    }

    // Safe operation — allow
    return { allowed: true, requiresConfirmation: false };
  }

  async requestPermission(request: PermissionRequest): Promise<boolean> {
    if (!this.resolver) {
      // No resolver — default to allow in auto mode, deny in plan mode
      return this.config.mode !== "plan";
    }

    return this.resolver(request);
  }

  private classifyOperation(tool: string, _args: Record<string, unknown>): OperationType {
    switch (tool) {
      case "file_read":
        return "file_read";
      case "file_write":
        return "file_write";
      case "shell":
        return "shell_exec";
      case "git_add":
        return "git_add";
      case "git_commit":
        return "git_commit";
      default:
        return "shell_exec";
    }
  }

  private isDestructive(operation: OperationType): boolean {
    return [
      "file_write",
      "file_delete",
      "shell_exec",
      "git_add",
      "git_commit",
      "git_push",
    ].includes(operation);
  }

  private matchesDenyPattern(tool: string, args: Record<string, unknown>): boolean {
    for (const pattern of this.config.denyPatterns) {
      const command = String(args["command"] ?? args["path"] ?? "");
      if (command.includes(pattern)) return true;
    }
    return false;
  }
}

export function formatPermissionRequest(request: PermissionRequest): string {
  const riskIcon = request.risk === "high" ? "⚠" : request.risk === "medium" ? "◆" : "○";

  return `${riskIcon} Allow ${request.tool}?\n  ${request.description}`;
}

export function classifyRisk(
  tool: string,
  args: Record<string, unknown>,
): "low" | "medium" | "high" {
  if (tool === "file_read") return "low";
  if (tool === "git_status" || tool === "git_diff" || tool === "git_log") return "low";

  if (tool === "git_commit" || tool === "git_push") return "high";

  const command = String(args["command"] ?? "");
  if (command.match(/rm\s|sudo\s|chmod\s/)) return "high";

  return "medium";
}
