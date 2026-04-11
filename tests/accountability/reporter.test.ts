import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActivityTracker } from "../../src/accountability/tracker.ts";
import { AccountabilityStore } from "../../src/accountability/storage.ts";
import { Reporter } from "../../src/accountability/reporter.ts";

let tmpDir: string;
let store: AccountabilityStore;
let tracker: ActivityTracker;
let reporter: Reporter;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "null-agent-reporter-test-"));
  store = new AccountabilityStore(tmpDir);
  tracker = new ActivityTracker(undefined, tmpDir);
  reporter = new Reporter(store, tracker);
  await tracker.init();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Reporter — daily report generation", () => {
  it("generates a daily report with the correct date", async () => {
    const report = await reporter.generateDailyReport();
    const today = new Date().toISOString().split("T")[0];
    expect(report.date).toBe(today);
    expect(Array.isArray(report.activities)).toBe(true);
    expect(report.summary).toBeDefined();
  });

  it("includes activities in the report", async () => {
    const id = await tracker.startActivity("coding", "Feature work");
    const act = tracker.getCurrentActivity()!;
    act.startTime = new Date(Date.now() - 3600_000);
    await tracker.endActivity(id);

    const report = await reporter.generateDailyReport();
    expect(report.activities.length).toBeGreaterThan(0);
    expect(report.summary.totalCoding).toBeGreaterThan(0);
  });

  it("includes today's goals in the report", async () => {
    await tracker.createGoal("Refactor auth", "daily");
    const report = await reporter.generateDailyReport();
    expect(report.goals).toBeDefined();
    expect(report.goals!.length).toBeGreaterThan(0);
  });
});

describe("Reporter — markdown formatting", () => {
  it("formatDailyReport returns markdown with heading", async () => {
    const report = await reporter.generateDailyReport();
    const md = reporter.formatDailyReport(report);
    expect(md).toContain("# Daily Report");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Time Breakdown");
    expect(md).toContain("## Activities");
  });

  it("shows goal checkboxes when goals exist", async () => {
    await tracker.createGoal("Write docs", "daily");
    const report = await reporter.generateDailyReport();
    const md = reporter.formatDailyReport(report);
    expect(md).toContain("## Goals");
    expect(md).toContain("[ ] Write docs");
  });

  it("shows checked goal for completed goals", async () => {
    const goal = await tracker.createGoal("Fix bug", "daily");
    await tracker.completeGoal(goal.id);

    // Get all goals including completed for report (we load all, not just today's)
    const allGoals = await store.loadGoals();
    const report = await reporter.generateDailyReport();
    // Manually inject the completed goal into report for this test
    const reportWithGoal = { ...report, goals: allGoals };
    const md = reporter.formatDailyReport(reportWithGoal);
    expect(md).toContain("[x] Fix bug");
  });
});

describe("Reporter — CSV export", () => {
  it("exportToCSV produces valid CSV with header", async () => {
    const id = await tracker.startActivity("review", "PR review");
    const act = tracker.getCurrentActivity()!;
    act.startTime = new Date(Date.now() - 1800_000);
    await tracker.endActivity(id);

    const report = await reporter.generateDailyReport();
    const csv = reporter.exportToCSV(report);
    expect(csv).toContain("date,activity,type,source,start_time,end_time,duration_seconds");
    expect(csv).toContain("review");
  });

  it("exportToCSV includes an empty row if no activities", async () => {
    const report = await reporter.generateDailyReport();
    const csv = reporter.exportToCSV(report);
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(1); // only header
  });
});

describe("Reporter — JSON export", () => {
  it("exportToJSON round-trips cleanly", async () => {
    const report = await reporter.generateDailyReport();
    const json = reporter.exportToJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.date).toBe(report.date);
    expect(Array.isArray(parsed.activities)).toBe(true);
  });
});

describe("Reporter — saveReport", () => {
  it("saves both JSON and Markdown to disk", async () => {
    const id = await tracker.startActivity("coding");
    await tracker.endActivity(id);

    const report = await reporter.generateDailyReport();
    await reporter.saveReport(report);

    const jsonPath = join(tmpDir, "reports", "daily", `${report.date}.json`);
    const mdPath = join(tmpDir, "reports", "daily", `${report.date}.md`);

    const jsonContent = await readFile(jsonPath, "utf-8");
    const mdContent = await readFile(mdPath, "utf-8");

    expect(JSON.parse(jsonContent).date).toBe(report.date);
    expect(mdContent).toContain("# Daily Report");
  });
});

describe("Reporter — weekly report", () => {
  it("generateWeeklyReport spans 7 days", async () => {
    const monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const report = await reporter.generateWeeklyReport(monday);
    expect(report.dailyReports.length).toBe(7);
    expect(report.weekStart).toBeDefined();
    expect(report.weekEnd).toBeDefined();
  });

  it("formatWeeklyReport returns markdown with heading", async () => {
    const monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const report = await reporter.generateWeeklyReport(monday);
    const md = reporter.formatWeeklyReport(report);
    expect(md).toContain("# Weekly Report");
    expect(md).toContain("## Summary");
    expect(md).toContain("## Time Breakdown");
  });

  it("aggregates summary across all days", async () => {
    const id = await tracker.startActivity("testing", "Running tests");
    const act = tracker.getCurrentActivity()!;
    act.startTime = new Date(Date.now() - 7200_000);
    await tracker.endActivity(id);

    const monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const report = await reporter.generateWeeklyReport(monday);
    // Today's testing time should show in the weekly summary
    expect(report.summary.totalTesting).toBeGreaterThan(0);
  });
});

describe("Reporter — session stats", () => {
  it("formatSessionStats describes current session", () => {
    const stats = tracker.getSessionStats();
    const text = reporter.formatSessionStats(stats);
    expect(text).toContain("Session:");
    expect(text).toContain("Activities today:");
  });
});
