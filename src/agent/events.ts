export type AgentEventType =
  | "agent_start"
  | "turn_start"
  | "message_start"
  | "message_update"
  | "message_end"
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end"
  | "tool_result"
  | "agent_end"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface AgentEventHandlers {
  onEvent?: (event: AgentEvent) => void | Promise<void>;
  onAgentStart?: (data: { message: string }) => void | Promise<void>;
  onTurnStart?: (data: { turn: number }) => void | Promise<void>;
  onMessageStart?: (data: { role: string }) => void | Promise<void>;
  onMessageUpdate?: (data: { content: string; delta: string }) => void | Promise<void>;
  onMessageEnd?: (data: { content: string }) => void | Promise<void>;
  onToolExecutionStart?: (data: {
    toolCallId: string;
    name: string;
    arguments: Record<string, unknown>;
  }) => void | Promise<void>;
  onToolExecutionUpdate?: (data: {
    toolCallId: string;
    partialResult: string;
  }) => void | Promise<void>;
  onToolExecutionEnd?: (data: {
    toolCallId: string;
    name: string;
    result: string;
    isError: boolean;
  }) => void | Promise<void>;
  onToolResult?: (data: { name: string; result: string; isError: boolean }) => void | Promise<void>;
  onAgentEnd?: (data: {
    content: string;
    iterations: number;
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  }) => void | Promise<void>;
  onError?: (data: { error: string }) => void | Promise<void>;
}

export class AgentEventEmitter {
  private handlers: AgentEventHandlers = {};
  private eventQueue: Array<() => void | Promise<void>> = [];

  setHandlers(handlers: AgentEventHandlers): void {
    this.handlers = handlers;
  }

  async emit(event: AgentEvent): Promise<void> {
    const handler = this.getHandler(event.type);
    if (handler) {
      const promise = handler(event.data as any);
      if (promise instanceof Promise) {
        this.eventQueue.push(() => promise);
      }
    }
    this.handlers.onEvent?.(event);
  }

  private getHandler(type: AgentEventType): ((data: any) => void | Promise<void>) | undefined {
    switch (type) {
      case "agent_start":
        return this.handlers.onAgentStart;
      case "turn_start":
        return this.handlers.onTurnStart;
      case "message_start":
        return this.handlers.onMessageStart;
      case "message_update":
        return this.handlers.onMessageUpdate;
      case "message_end":
        return this.handlers.onMessageEnd;
      case "tool_execution_start":
        return this.handlers.onToolExecutionStart;
      case "tool_execution_update":
        return this.handlers.onToolExecutionUpdate;
      case "tool_execution_end":
        return this.handlers.onToolExecutionEnd;
      case "tool_result":
        return this.handlers.onToolResult;
      case "agent_end":
        return this.handlers.onAgentEnd;
      case "error":
        return this.handlers.onError;
      default:
        return undefined;
    }
  }

  async waitForSettled(): Promise<void> {
    for (const fn of this.eventQueue) {
      await fn();
    }
    this.eventQueue = [];
  }

  clear(): void {
    this.handlers = {};
    this.eventQueue = [];
  }
}

export function createAgentEvent(type: AgentEventType, data?: Record<string, unknown>): AgentEvent {
  return {
    type,
    timestamp: Date.now(),
    data,
  };
}
