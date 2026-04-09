import { expect, test } from "vite-plus/test";
import { SessionManager, type TerminalSession } from "../../src/feet/session-manager.ts";

test("SessionManager: create should create a session with generated id and name", async () => {
  const manager = new SessionManager();
  const session = await manager.create();

  expect(session.id).toBeDefined();
  expect(session.id.length).toBe(36);
  expect(session.name).toMatch(/^session-[a-f0-9]{8}$/);
  expect(session.isActive).toBe(true);
  expect(session.cwd).toBe(process.cwd());
});

test("SessionManager: create should create a session with custom name", async () => {
  const manager = new SessionManager();
  const session = await manager.create({ name: "my-session" });

  expect(session.name).toBe("my-session");
});

test("SessionManager: create should create a session with custom cwd", async () => {
  const manager = new SessionManager();
  const session = await manager.create({ cwd: "/tmp" });

  expect(session.cwd).toBe("/tmp");
});

test("SessionManager: create should store session in manager", async () => {
  const manager = new SessionManager();
  const session = await manager.create({ name: "stored" });

  expect(manager.get(session.id)).toEqual(session);
});

test("SessionManager: list should return empty array when no sessions exist", () => {
  const manager = new SessionManager();
  expect(manager.list()).toEqual([]);
});

test("SessionManager: list should return all created sessions", async () => {
  const manager = new SessionManager();
  const session1 = await manager.create({ name: "session-1" });
  const session2 = await manager.create({ name: "session-2" });

  const list = manager.list();

  expect(list).toHaveLength(2);
  expect(list).toContainEqual(session1);
  expect(list).toContainEqual(session2);
});

test("SessionManager: get should return undefined for non-existent session", () => {
  const manager = new SessionManager();
  expect(manager.get("non-existent-id")).toBeUndefined();
});

test("SessionManager: get should return session by id", async () => {
  const manager = new SessionManager();
  const session = await manager.create({ name: "get-test" });

  expect(manager.get(session.id)).toEqual(session);
});

test("SessionManager: close should mark session as inactive", async () => {
  const manager = new SessionManager();
  const session = await manager.create();

  manager.close(session.id);

  expect(manager.get(session.id)?.isActive).toBe(false);
});

test("SessionManager: close should keep session in manager but marked inactive", async () => {
  const manager = new SessionManager();
  const session = await manager.create();

  manager.close(session.id);

  expect(manager.get(session.id)).toBeDefined();
});

test("SessionManager: attach should throw error for non-existent session", async () => {
  const manager = new SessionManager();
  await expect(manager.attach("non-existent-id")).rejects.toThrow(
    "Session non-existent-id not found or inactive",
  );
});

test("SessionManager: attach should throw error for inactive session", async () => {
  const manager = new SessionManager();
  const session = await manager.create();
  manager.close(session.id);

  await expect(manager.attach(session.id)).rejects.toThrow(
    `Session ${session.id} not found or inactive`,
  );
});

test("SessionManager: attach should execute command and return output", async () => {
  const manager = new SessionManager();
  const session = await manager.create();

  const result = await manager.attach(session.id, "echo hello");

  expect(result.output.trim()).toBe("hello");
  expect(result.exitCode).toBe(0);
});
