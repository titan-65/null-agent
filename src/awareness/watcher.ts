import { watch, type FSWatcher } from "node:fs";
import { join, relative } from "node:path";
import type { AwarenessEvent } from "./types.ts";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".nuxt",
  ".turbo",
  ".superpowers",
  "__pycache__",
]);

const DEBOUNCE_MS = 500;

export class FileWatcher {
  private projectDir: string;
  private watcher: FSWatcher | null = null;
  private callback: ((event: AwarenessEvent) => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: Map<string, AwarenessEvent> = new Map();

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  start(callback: (event: AwarenessEvent) => void): void {
    this.callback = callback;

    try {
      this.watcher = watch(this.projectDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Skip ignored directories
        const parts = filename.split("/");
        if (parts.some((p) => IGNORE_DIRS.has(p))) return;

        this.handleEvent(eventType, filename);
      });
    } catch {
      // fs.watch not available or failed
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleEvent(eventType: string, filename: string): void {
    const relPath = relative(this.projectDir, join(this.projectDir, filename));

    // Determine event type
    let type: AwarenessEvent["type"];
    if (eventType === "rename") {
      // rename could be create or delete — check if file exists
      try {
        const { statSync } = require("node:fs");
        statSync(join(this.projectDir, filename));
        type = "file:create";
      } catch {
        type = "file:delete";
      }
    } else {
      type = "file:modify";
    }

    const event: AwarenessEvent = {
      type,
      message: relPath,
      timestamp: Date.now(),
    };

    // Debounce: collect events, flush after delay
    this.pendingEvents.set(relPath, event);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushEvents();
    }, DEBOUNCE_MS);
  }

  private flushEvents(): void {
    if (!this.callback || this.pendingEvents.size === 0) return;

    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();

    // Group events by type
    const creates = events.filter((e) => e.type === "file:create");
    const modifies = events.filter((e) => e.type === "file:modify");
    const deletes = events.filter((e) => e.type === "file:delete");

    // Emit grouped events
    if (creates.length > 0) {
      this.callback({
        type: "file:create",
        message: creates.length === 1 ? creates[0]!.message : `${creates.length} files`,
        timestamp: Date.now(),
        details: { files: creates.map((e) => e.message) },
      });
    }

    if (modifies.length > 0) {
      this.callback({
        type: "file:modify",
        message: modifies.length === 1 ? modifies[0]!.message : `${modifies.length} files`,
        timestamp: Date.now(),
        details: { files: modifies.map((e) => e.message) },
      });
    }

    if (deletes.length > 0) {
      this.callback({
        type: "file:delete",
        message: deletes.length === 1 ? deletes[0]!.message : `${deletes.length} files`,
        timestamp: Date.now(),
        details: { files: deletes.map((e) => e.message) },
      });
    }
  }
}
