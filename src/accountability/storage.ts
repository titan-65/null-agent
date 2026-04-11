import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import type { Activity, Goal, AccountabilityConfig, DayReport } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

function getDateString(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split("T")[0]!;
}

export class AccountabilityStore {
  private baseDir: string;
  private initialized = false;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(homedir(), ".null-agent", "accountability");
  }

  private get activitiesDir(): string {
    return join(this.baseDir, "activities");
  }

  private get reportsDir(): string {
    return join(this.baseDir, "reports");
  }

  private get goalsDir(): string {
    return join(this.baseDir, "goals");
  }

  private get configFile(): string {
    return join(this.baseDir, "config.json");
  }

  private get goalsFile(): string {
    return join(this.goalsDir, "goals.json");
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.baseDir, { recursive: true });
    await mkdir(this.activitiesDir, { recursive: true });
    await mkdir(this.reportsDir, { recursive: true });
    await mkdir(join(this.reportsDir, "daily"), { recursive: true });
    await mkdir(join(this.reportsDir, "weekly"), { recursive: true });
    await mkdir(this.goalsDir, { recursive: true });
    this.initialized = true;
  }

  async loadConfig(): Promise<AccountabilityConfig> {
    await this.init();
    try {
      const content = await readFile(this.configFile, "utf-8");
      return JSON.parse(content) as AccountabilityConfig;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  async saveConfig(config: AccountabilityConfig): Promise<void> {
    await this.init();
    await writeFile(this.configFile, JSON.stringify(config, null, 2), "utf-8");
  }

  async saveActivity(activity: Activity): Promise<void> {
    await this.init();
    const dateStr = getDateString(activity.startTime);
    const filePath = join(this.activitiesDir, `${dateStr}.json`);
    let activities: Activity[] = [];
    try {
      const content = await readFile(filePath, "utf-8");
      activities = JSON.parse(content) as Activity[];
    } catch {
      activities = [];
    }

    const existingIndex = activities.findIndex((a) => a.id === activity.id);
    if (existingIndex >= 0) {
      activities[existingIndex] = {
        ...activity,
        startTime: new Date(activity.startTime),
        endTime: activity.endTime ? new Date(activity.endTime) : undefined,
      };
    } else {
      activities.push({
        ...activity,
        startTime: new Date(activity.startTime),
        endTime: activity.endTime ? new Date(activity.endTime) : undefined,
      });
    }

    await writeFile(filePath, JSON.stringify(activities, null, 2), "utf-8");
  }

  async loadActivities(date?: Date): Promise<Activity[]> {
    await this.init();
    const dateStr = getDateString(date);
    const filePath = join(this.activitiesDir, `${dateStr}.json`);
    try {
      const content = await readFile(filePath, "utf-8");
      const activities = JSON.parse(content) as Activity[];
      return activities.map((a) => ({
        ...a,
        startTime: new Date(a.startTime),
        endTime: a.endTime ? new Date(a.endTime) : undefined,
      }));
    } catch {
      return [];
    }
  }

  async loadActivitiesInRange(start: Date, end: Date): Promise<Activity[]> {
    const activities: Activity[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dayActivities = await this.loadActivities(current);
      activities.push(...dayActivities);
      current.setDate(current.getDate() + 1);
    }
    return activities;
  }

  async saveGoals(goals: Goal[]): Promise<void> {
    await this.init();
    await writeFile(this.goalsFile, JSON.stringify(goals, null, 2), "utf-8");
  }

  async loadGoals(): Promise<Goal[]> {
    await this.init();
    try {
      const content = await readFile(this.goalsFile, "utf-8");
      const goals = JSON.parse(content) as Goal[];
      return goals.map((g) => ({
        ...g,
        dueDate: g.dueDate ? new Date(g.dueDate) : undefined,
        completedDate: g.completedDate ? new Date(g.completedDate) : undefined,
      }));
    } catch {
      return [];
    }
  }

  async saveDailyReport(date: string, report: DayReport, markdown?: string): Promise<void> {
    await this.init();
    const jsonPath = join(this.reportsDir, "daily", `${date}.json`);
    await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");
    if (markdown) {
      const mdPath = join(this.reportsDir, "daily", `${date}.md`);
      await writeFile(mdPath, markdown, "utf-8");
    }
  }

  async saveWeeklyReport(weekLabel: string, markdown: string): Promise<void> {
    await this.init();
    const mdPath = join(this.reportsDir, "weekly", `${weekLabel}.md`);
    await writeFile(mdPath, markdown, "utf-8");
  }

  async loadDailyReport(date: string): Promise<DayReport | null> {
    await this.init();
    const jsonPath = join(this.reportsDir, "daily", `${date}.json`);
    try {
      const content = await readFile(jsonPath, "utf-8");
      return JSON.parse(content) as DayReport;
    } catch {
      return null;
    }
  }
}
