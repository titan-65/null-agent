export type AwarenessEventType =
  | "git:change"
  | "git:branch"
  | "git:conflict"
  | "file:create"
  | "file:modify"
  | "file:delete";

export interface AwarenessEvent {
  type: AwarenessEventType;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface AwarenessConfig {
  projectDir: string;
  gitPollIntervalMs?: number;
  enabled?: boolean;
}

export interface AwarenessCallbacks {
  onEvent?: (event: AwarenessEvent) => void;
}

export function formatEvent(event: AwarenessEvent): string {
  switch (event.type) {
    case "git:change":
      return `git: ${event.message}`;
    case "git:branch":
      return `git: switched to ${event.message}`;
    case "git:conflict":
      return `git: merge conflict — ${event.message}`;
    case "file:create":
      return `file: created ${event.message}`;
    case "file:modify":
      return `file: modified ${event.message}`;
    case "file:delete":
      return `file: deleted ${event.message}`;
    default:
      return event.message;
  }
}
