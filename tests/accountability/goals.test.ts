import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountabilityStore } from "../../src/accountability/storage.ts";
import { GoalTracker } from "../../src/accountability/goals.ts";

let tmpDir: string;
let store: AccountabilityStore;
let goals: GoalTracker;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "null-agent-goals-test-"));
  store = new AccountabilityStore(tmpDir);
  await store.init();
  goals = new GoalTracker(store);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("GoalTracker — creation", () => {
  it("creates a daily goal with pending status", async () => {
    const goal = await goals.createGoal("Ship auth feature", "daily");
    expect(goal.id).toBeDefined();
    expect(goal.type).toBe("daily");
    expect(goal.status).toBe("pending");
    expect(goal.description).toBe("Ship auth feature");
  });

  it("creates a weekly goal", async () => {
    const goal = await goals.createGoal("Review all open PRs", "weekly");
    expect(goal.type).toBe("weekly");
  });

  it("creates a sprint goal with due date", async () => {
    const due = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 1 week from now
    const goal = await goals.createGoal("Finish sprint tasks", "sprint", due);
    expect(goal.dueDate).toBeDefined();
  });

  it("persists goals across store reloads", async () => {
    await goals.createGoal("Persistent goal", "daily");
    const store2 = new AccountabilityStore(tmpDir);
    const goals2 = new GoalTracker(store2);
    const all = await goals2.getAllGoals();
    expect(all.length).toBe(1);
    expect(all[0]!.description).toBe("Persistent goal");
  });
});

describe("GoalTracker — status updates", () => {
  it("marks goal as in-progress on progress update", async () => {
    const goal = await goals.createGoal("Write tests", "daily");
    await goals.updateGoalProgress(goal.id, "activity-1");

    const all = await goals.getAllGoals();
    const updated = all.find((g) => g.id === goal.id);
    expect(updated?.status).toBe("in-progress");
    expect(updated?.activities).toContain("activity-1");
  });

  it("links multiple activity IDs to goal", async () => {
    const goal = await goals.createGoal("Multi-activity goal", "daily");
    await goals.updateGoalProgress(goal.id, "act-1");
    await goals.updateGoalProgress(goal.id, "act-2");

    const all = await goals.getAllGoals();
    const updated = all.find((g) => g.id === goal.id);
    expect(updated?.activities?.length).toBe(2);
  });

  it("does not duplicate activity ID on repeat calls", async () => {
    const goal = await goals.createGoal("Dedupe test", "daily");
    await goals.updateGoalProgress(goal.id, "act-1");
    await goals.updateGoalProgress(goal.id, "act-1");

    const all = await goals.getAllGoals();
    const updated = all.find((g) => g.id === goal.id);
    expect(updated?.activities?.length).toBe(1);
  });

  it("completes a goal and sets completedDate", async () => {
    const goal = await goals.createGoal("Complete me", "daily");
    const completed = await goals.completeGoal(goal.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.completedDate).toBeDefined();
  });

  it("returns null when completing non-existent goal", async () => {
    const result = await goals.completeGoal("does-not-exist");
    expect(result).toBeNull();
  });

  it("marks goal as missed", async () => {
    const goal = await goals.createGoal("Missed goal", "daily");
    await goals.missGoal(goal.id);

    const all = await goals.getAllGoals();
    const updated = all.find((g) => g.id === goal.id);
    expect(updated?.status).toBe("missed");
  });
});

describe("GoalTracker — filtering", () => {
  it("getTodaysGoals returns only daily + non-completed goals", async () => {
    const g1 = await goals.createGoal("Daily task", "daily");
    const g2 = await goals.createGoal("Done task", "daily");
    await goals.completeGoal(g2.id);

    const today = await goals.getTodaysGoals();
    expect(today.find((g) => g.id === g1.id)).toBeDefined();
    expect(today.find((g) => g.id === g2.id)).toBeUndefined();
  });

  it("getTodaysGoals includes sprint goals due today", async () => {
    // Use noon so the date is stable across all UTC offsets
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    const goal = await goals.createGoal("Sprint goal due today", "sprint", todayNoon);

    const today = await goals.getTodaysGoals();
    expect(today.find((g) => g.id === goal.id)).toBeDefined();
  });

  it("getOverdueGoals returns goals with past due dates", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const goal = await goals.createGoal("Overdue sprint task", "sprint", yesterday);

    const overdue = await goals.getOverdueGoals();
    expect(overdue.find((g) => g.id === goal.id)).toBeDefined();
  });

  it("getOverdueGoals excludes completed goals", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const goal = await goals.createGoal("Done overdue task", "sprint", yesterday);
    await goals.completeGoal(goal.id);

    const overdue = await goals.getOverdueGoals();
    expect(overdue.find((g) => g.id === goal.id)).toBeUndefined();
  });

  it("getGoalsByStatus filters correctly", async () => {
    await goals.createGoal("Pending A", "daily");
    await goals.createGoal("Pending B", "daily");
    const g = await goals.createGoal("To complete", "daily");
    await goals.completeGoal(g.id);

    const pending = await goals.getGoalsByStatus("pending");
    const completed = await goals.getGoalsByStatus("completed");

    expect(pending.length).toBe(2);
    expect(completed.length).toBe(1);
  });
});

describe("GoalTracker — deletion", () => {
  it("deletes a goal by ID", async () => {
    const goal = await goals.createGoal("To delete", "daily");
    await goals.deleteGoal(goal.id);

    const all = await goals.getAllGoals();
    expect(all.find((g) => g.id === goal.id)).toBeUndefined();
  });

  it("is a no-op when deleting non-existent goal", async () => {
    await goals.createGoal("Remaining", "daily");
    await goals.deleteGoal("does-not-exist");

    const all = await goals.getAllGoals();
    expect(all.length).toBe(1);
  });
});

describe("GoalTracker — formatting", () => {
  it("formatGoalList shows icons and short IDs", async () => {
    const g1 = await goals.createGoal("Pending task", "daily");
    const g2 = await goals.createGoal("In progress task", "daily");
    await goals.updateGoalProgress(g2.id, "act-1");
    const g3 = await goals.createGoal("Done task", "daily");
    await goals.completeGoal(g3.id);

    const all = await goals.getAllGoals();
    const text = goals.formatGoalList(all);

    expect(text).toContain("○"); // pending
    expect(text).toContain("⟳"); // in-progress
    expect(text).toContain("✓"); // completed
    expect(text).toContain(g1.id.slice(0, 8));
  });

  it("formatGoalList returns message when empty", () => {
    const text = goals.formatGoalList([]);
    expect(text).toContain("No goals");
  });
});
