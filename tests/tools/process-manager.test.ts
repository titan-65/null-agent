import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { ProcessManager } from "../../src/feet/process-manager.ts";

describe("ProcessManager", () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager();
  });

  afterEach(async () => {
    const processes = manager.list();
    await Promise.all(processes.map((p) => manager.stop(p.id)));
  });

  describe("start", () => {
    it("should start a process and return its managed form", async () => {
      const proc = await manager.start({
        command: "echo 'hello'",
        name: "test-echo",
      });

      expect(proc.id).toBeDefined();
      expect(proc.name).toBe("test-echo");
      expect(proc.command).toBe("echo 'hello'");
      expect(proc.pid).toBeGreaterThan(0);
      expect(proc.status).toBe("running");
      expect(proc.startedAt).toBeGreaterThan(0);
    });

    it("should auto-generate name if not provided", async () => {
      const proc = await manager.start({
        command: "sleep 60",
      });

      expect(proc.name).toMatch(/^process-[a-f0-9]{8}$/);
    });

    it("should track the process internally", async () => {
      const proc = await manager.start({ command: "echo 'tracked'" });

      const tracked = manager.list();
      expect(tracked).toHaveLength(1);
      expect(tracked[0].id).toBe(proc.id);
    });
  });

  describe("list", () => {
    it("should return all running processes", async () => {
      await manager.start({ command: "echo 'one'" });
      await manager.start({ command: "echo 'two'" });

      const processes = manager.list();
      expect(processes).toHaveLength(2);
    });

    it("should return empty array when no processes running", () => {
      const processes = manager.list();
      expect(processes).toEqual([]);
    });
  });

  describe("stop", () => {
    it("should stop a running process", async () => {
      const proc = await manager.start({ command: "sleep 60" });

      const result = await manager.stop(proc.id);

      expect(result.success).toBe(true);
      expect(result.signal).toBe("SIGTERM");

      const tracked = manager.list();
      const found = tracked.find((p) => p.id === proc.id);
      expect(found?.status).toBe("stopped");
    });

    it("should force kill with SIGKILL when force=true", async () => {
      const proc = await manager.start({ command: "sleep 60" });

      const result = await manager.stop(proc.id, true);

      expect(result.success).toBe(true);
      expect(result.signal).toBe("SIGKILL");
    });

    it("should return success=false for non-existent process", async () => {
      const result = await manager.stop("non-existent-id");
      expect(result.success).toBe(false);
    });
  });
});
