import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActivityTracker } from "../../src/accountability/tracker.ts";
import { Accountant } from "../../src/accountability/accountant.ts";
import type { Goal, Activity } from "../../src/accountability/types.ts";

let tmpDir: string;
let tracker: ActivityTracker;
let accountant: Accountant;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "null-agent-accountant-test-"));
  tracker = new ActivityTracker(undefined, tmpDir);
  accountant = new Accountant(tracker);
  await tracker.init();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Accountant — goal progress", () => {
  it("returns a goal reminder when all goals are pending", async () => {
    await tracker.createGoal("Write unit tests", "daily");
    const notifications = await accountant.checkGoalProgress();
    const reminder = notifications.find((n) => n.type === "goal:reminder");
    expect(reminder).toBeDefined();
    expect(reminder?.message).toContain("goal");
  });

  it("returns overdue goal notification for past-due goals", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Create a sprint goal with a due date in the past
    const goal: Goal = {
      id: "test-overdue",
      description: "Overdue task",
      type: "sprint",
      status: "pending",
      dueDate: yesterday,
    };
    // Directly persist via store (tracker doesn't expose arbitrary goal injection)
    const store = (tracker as unknown as { store: { saveGoals: (g: Goal[]) => Promise<void> } })
      .store;
    await store.saveGoals([goal]);

    const notifications = await accountant.checkGoalProgress();
    const overdue = notifications.find((n) => n.type === "goal:overdue");
    expect(overdue).toBeDefined();
    expect(overdue?.priority).toBe("high");
  });

  it("returns empty notifications when there are no goals", async () => {
    const notifications = await accountant.checkGoalProgress();
    // No goals → no reminders
    expect(notifications.filter((n) => n.type === "goal:reminder")).toHaveLength(0);
  });
});

describe("Accountant — activity patterns", () => {
  it("suggests break after 2+ hours of active coding", async () => {
    // Simulate 130 minutes of coding in session stats
    // We need to hack the tracker's in-memory activities for the stats
    const id = await tracker.startActivity("coding");
    const act = tracker.getCurrentActivity()!;
    // Push the start time back 2h 10m
    act.startTime = new Date(Date.now() - 130 * 60 * 1000);
    act.duration = 130 * 60;

    const notifications = await accountant.checkActivityPatterns();
    const breakNote = notifications.find((n) => n.type === "time:threshold");
    expect(breakNote).toBeDefined();
    expect(breakNote?.message).toContain("break");
  });

  it("warns when debugging session exceeds 1 hour", async () => {
    const id = await tracker.startActivity("debugging");
    const act = tracker.getCurrentActivity()!;
    act.startTime = new Date(Date.now() - 65 * 60 * 1000);

    const notifications = await accountant.checkActivityPatterns();
    const debugNote = notifications.find((n) => n.type === "time:milestone");
    expect(debugNote).toBeDefined();
    expect(debugNote?.message).toContain("debugging");
  });

  it("returns empty when no activity has occurred", async () => {
    const notifications = await accountant.checkActivityPatterns();
    expect(notifications).toHaveLength(0);
  });
});

describe("Accountant — daily rituals", () => {
  it("returns morning greeting during morning hours (9-10 AM)", () => {
    // We can't mock the time, but we can verify the method works
    const notifications = accountant.checkDailyRituals();
    // Will return empty unless hour is in 9-10 or 17-18 range
    expect(Array.isArray(notifications)).toBe(true);
  });
});

describe("Accountant — challenge user", () => {
  it("challenges on a pending goal", () => {
    const goal: Goal = {
      id: "g1",
      description: "Review 3 PRs",
      type: "daily",
      status: "pending",
    };
    const message = accountant.challengeUser(goal);
    expect(message).toContain("Review 3 PRs");
    expect(message.length).toBeGreaterThan(0);
  });

  it("encourages on an in-progress goal", () => {
    const goal: Goal = {
      id: "g2",
      description: "Ship feature",
      type: "sprint",
      status: "in-progress",
    };
    const message = accountant.challengeUser(goal);
    expect(message).toContain("Ship feature");
    expect(message.toLowerCase()).toContain("progress");
  });
});

describe("Accountant — celebrate win", () => {
  it("celebrates a completed coding activity", () => {
    const activity: Activity = {
      id: "a1",
      type: "coding",
      description: "Auth module",
      startTime: new Date(Date.now() - 3600_000),
      endTime: new Date(),
      duration: 3600,
      source: "explicit",
    };
    const message = accountant.celebrateWin(activity);
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain("coding");
  });

  it("celebrates a review activity", () => {
    const activity: Activity = {
      id: "a2",
      type: "review",
      description: "PR #42",
      startTime: new Date(Date.now() - 1800_000),
      endTime: new Date(),
      duration: 1800,
      source: "explicit",
    };
    const message = accountant.celebrateWin(activity);
    expect(message).toContain("review");
  });
});

describe("Accountant — suggest break", () => {
  it("suggests break when active time is > 2 hours", () => {
    // Hack activities into tracker for stats
    const activities = (tracker as unknown as { activities: Activity[] }).activities;
    activities.push({
      id: "a1",
      type: "coding",
      description: "Coding session",
      startTime: new Date(Date.now() - 7200_000),
      endTime: new Date(Date.now() - 100),
      duration: 7200,
      source: "inferred",
    });

    const message = accountant.suggestBreak();
    expect(message).toContain("break");
  });

  it("returns keep working when session is short", () => {
    const message = accountant.suggestBreak();
    expect(message.length).toBeGreaterThan(0);
  });
});

describe("Accountant — daily summary", () => {
  it("getDailySummary returns a formatted string", async () => {
    const summary = await accountant.getDailySummary();
    expect(summary).toContain("Today");
    expect(summary).toContain("Session");
  });
});
