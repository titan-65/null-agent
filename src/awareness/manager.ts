import type { AwarenessConfig, AwarenessEvent, AwarenessCallbacks } from "./types.ts";
import { GitMonitor } from "./git.ts";
import { FileWatcher } from "./watcher.ts";

const GIT_POLL_INTERVAL_MS = 15_000; // 15 seconds
const EVENT_COOLDOWN_MS = 5_000; // Don't spam — 5s between same-type events

export class AwarenessManager {
  private config: AwarenessConfig;
  private gitMonitor: GitMonitor;
  private fileWatcher: FileWatcher;
  private callbacks: AwarenessCallbacks = {};
  private lastEventTime: Map<string, number> = new Map();
  private running = false;

  constructor(config: AwarenessConfig) {
    this.config = config;
    this.gitMonitor = new GitMonitor(config.projectDir);
    this.fileWatcher = new FileWatcher(config.projectDir);
  }

  start(callbacks: AwarenessCallbacks): void {
    if (this.running) return;
    if (this.config.enabled === false) return;

    this.running = true;
    this.callbacks = callbacks;

    const pollInterval = this.config.gitPollIntervalMs ?? GIT_POLL_INTERVAL_MS;

    this.gitMonitor.start((event) => this.emit(event), pollInterval);
    this.fileWatcher.start((event) => this.emit(event));
  }

  stop(): void {
    this.running = false;
    this.gitMonitor.stop();
    this.fileWatcher.stop();
  }

  private emit(event: AwarenessEvent): void {
    // Cooldown: don't spam the same event type
    const lastTime = this.lastEventTime.get(event.type) ?? 0;
    const now = Date.now();

    if (now - lastTime < EVENT_COOLDOWN_MS) return;

    this.lastEventTime.set(event.type, now);
    this.callbacks.onEvent?.(event);
  }
}
