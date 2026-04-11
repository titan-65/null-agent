import { describe, it, expect, beforeEach } from "vitest";
import { ActivityInferencer } from "../src/accountability/inferencer.ts";

describe("ActivityInferencer", () => {
  let inferencer: ActivityInferencer;

  beforeEach(() => {
    inferencer = new ActivityInferencer();
  });

  it("infers coding from file operations", () => {
    const result = inferencer.inferActivity("file_read", { path: "test.ts" }, "content");
    expect(result.type).toBe("coding");
  });

  it("infers testing from test commands", () => {
    const result = inferencer.inferActivity("shell", { command: "npm test" }, "");
    expect(result.type).toBe("testing");
  });

  it("infers debugging from debug commands", () => {
    const result = inferencer.inferActivity("shell", { command: "node inspect app.js" }, "");
    expect(result.type).toBe("debugging");
  });

  it("infers review from git diff", () => {
    const result = inferencer.inferActivity("git_diff", { staged: true }, "");
    expect(result.type).toBe("review");
  });

  it("infers planning from git branch", () => {
    const result = inferencer.inferActivity("git_branch", {}, "");
    expect(result.type).toBe("planning");
  });

  it("groups activities when time is close", () => {
    const shouldGroup = inferencer.shouldGroupActivity("coding", "coding", 2 * 60 * 1000, 5);
    expect(shouldGroup).toBe(true);
  });

  it("does not group activities when time is far", () => {
    const shouldGroup = inferencer.shouldGroupActivity("coding", "coding", 10 * 60 * 1000, 5);
    expect(shouldGroup).toBe(false);
  });

  it("detects idle after threshold", () => {
    const now = new Date();
    const lastActivity = new Date(now.getTime() - 35 * 60 * 1000);
    const idle = inferencer.detectIdle(now, lastActivity, 30);
    expect(idle).toBe(true);
  });

  it("does not detect idle before threshold", () => {
    const now = new Date();
    const lastActivity = new Date(now.getTime() - 20 * 60 * 1000);
    const idle = inferencer.detectIdle(now, lastActivity, 30);
    expect(idle).toBe(false);
  });
});
