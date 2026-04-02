export type EventName = string;

export interface EventBusEvent<T = unknown> {
  name: string;
  data: T;
  timestamp: number;
  cancelled: boolean;
  cancel(): void;
}

export type EventHandler<T = unknown> = (event: EventBusEvent<T>) => void | Promise<void>;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<T = unknown>(name: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(name)?.delete(handler as EventHandler<unknown>);
    };
  }

  once<T = unknown>(name: string, handler: EventHandler<T>): () => void {
    const wrapped: EventHandler<T> = (event) => {
      unsubscribe();
      handler(event);
    };
    const unsubscribe = this.on(name, wrapped);
    return unsubscribe;
  }

  async emit<T = unknown>(name: string, data: T): Promise<boolean> {
    const handlers = this.listeners.get(name);
    if (!handlers || handlers.size === 0) return true;

    let cancelled = false;
    const event: EventBusEvent<T> = {
      name,
      data,
      timestamp: Date.now(),
      cancelled: false,
      cancel() {
        cancelled = true;
        event.cancelled = true;
      },
    };

    for (const handler of handlers) {
      try {
        await handler(event as EventBusEvent<unknown>);
        if (cancelled) return false;
      } catch (error) {
        // Log but don't break the chain
        console.error(`Event handler error for "${name}":`, error);
      }
    }

    return !cancelled;
  }

  off(name: string, handler?: EventHandler): void {
    if (!handler) {
      this.listeners.delete(name);
    } else {
      this.listeners.get(name)?.delete(handler as EventHandler<unknown>);
    }
  }

  listenerCount(name: string): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  hasListeners(name: string): boolean {
    return this.listenerCount(name) > 0;
  }
}

// Built-in event types
export const Events = {
  // Agent events
  AGENT_THINKING: "agent:thinking",
  AGENT_TEXT: "agent:text",
  AGENT_DONE: "agent:done",
  AGENT_ERROR: "agent:error",

  // Tool events
  TOOL_BEFORE: "tool:before",
  TOOL_AFTER: "tool:after",
  TOOL_DENIED: "tool:denied",

  // Permission events
  PERMISSION_REQUEST: "permission:request",
  PERMISSION_GRANTED: "permission:granted",
  PERMISSION_DENIED: "permission:denied",

  // Session events
  SESSION_START: "session:start",
  SESSION_SAVE: "session:save",
  SESSION_END: "session:end",

  // Config events
  CONFIG_LOADED: "config:loaded",
  CONFIG_CHANGED: "config:changed",

  // Awareness events
  GIT_CHANGE: "git:change",
  FILE_CHANGE: "file:change",

  // UI events
  NOTIFICATION: "ui:notification",
  STATUS_CHANGE: "ui:status",
} as const;
