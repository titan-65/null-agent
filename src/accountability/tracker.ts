import type {
  Activity,
  ActivityType,
  ActivitySummary,
  SessionStats,
  Goal,
  AccountabilityConfig,
} from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { AccountabilityStore } from "./storage.ts";
import { ActivityInferencer } from "./inferencer.ts";
import { randomUUID } from "node:crypto";

export class ActivityTracker {
  private store: AccountabilityStore;
  private inferencer: ActivityInferencer;
  private config: AccountabilityConfig;
  private currentActivity: Activity | null = null;
  private activities: Activity[] = [];
  private sessionStartTime: Date = new Date();
  private lastToolCallTime: Date = new Date();

  constructor(config?: Partial<AccountabilityConfig>, baseDir?: string) {
    this.store = new AccountabilityStore(baseDir);
    this.inferencer = new ActivityInferencer();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    await this.store.init();
    this.activities = await this.store.loadActivities();
    this.config = await this.store.loadConfig();
  }

  async startActivity(type: ActivityType, description?: string): Promise<string> {
    if (this.currentActivity) {
      await this.endActivity(this.currentActivity.id);
    }

    const activity: Activity = {
      id: randomUUID(),
      type,
      description: description || type,
      startTime: new Date(),
      source: "explicit",
    };

    this.currentActivity = activity;
    this.activities.push(activity);
    await this.store.saveActivity(activity);
    return activity.id;
  }

  async endActivity(activityId: string): Promise<void> {
    const activity = this.activities.find((a) => a.id === activityId);
    if (!activity) return;

    activity.endTime = new Date();
    activity.duration = Math.floor(
      (activity.endTime.getTime() - activity.startTime.getTime()) / 1000,
    );

    await this.store.saveActivity(activity);
    if (this.currentActivity?.id === activityId) {
      this.currentActivity = null;
    }
  }

  async pauseActivity(activityId: string): Promise<void> {
    await this.endActivity(activityId);
  }

  async resumeActivity(activityId: string): Promise<void> {
    const activity = this.activities.find((a) => a.id === activityId);
    if (!activity) return;
    // Clear the endTime so the activity is "active" again
    activity.endTime = undefined;
    activity.duration = undefined;
    this.currentActivity = activity;
    await this.store.saveActivity(activity);
  }

  async recordToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ): Promise<void> {
    if (this.config.tracking.mode === "explicit") return;
    if (!this.config.tracking.autoInfer) return;

    const now = new Date();
    const { type, description } = this.inferencer.inferActivity(toolName, args, result);

    if (this.currentActivity) {
      const timeSinceLastCall = now.getTime() - this.lastToolCallTime.getTime();
      const shouldGroup = this.inferencer.shouldGroupActivity(
        this.currentActivity.type,
        type,
        timeSinceLastCall,
        this.config.tracking.activityGroupingMinutes,
      );

      if (shouldGroup) {
        this.lastToolCallTime = now;
        return;
      }

      await this.endActivity(this.currentActivity.id);
    }

    const activity: Activity = {
      id: randomUUID(),
      type,
      description,
      startTime: now,
      source: "inferred",
      metadata: {
        toolName,
      },
    };

    this.currentActivity = activity;
    this.activities.push(activity);
    this.lastToolCallTime = now;
    await this.store.saveActivity(activity);
  }

  getCurrentActivity(): Activity | null {
    return this.currentActivity;
  }

  async getTodayActivities(): Promise<Activity[]> {
    return this.store.loadActivities();
  }

  async getActivitiesInRange(start: Date, end: Date): Promise<Activity[]> {
    return this.store.loadActivitiesInRange(start, end);
  }

  async getActivitySummary(date?: Date): Promise<ActivitySummary> {
    const activities = await this.store.loadActivities(date);

    const summary: ActivitySummary = {
      totalCoding: 0,
      totalMeetings: 0,
      totalReviews: 0,
      totalDebugging: 0,
      totalDocs: 0,
      totalTesting: 0,
      totalOther: 0,
      meetingsAttended: 0,
      codeReviewsCompleted: 0,
      issuesResolved: 0,
      commitsMade: 0,
    };

    for (const activity of activities) {
      const duration = activity.duration || 0;
      switch (activity.type) {
        case "coding":
          summary.totalCoding += duration;
          break;
        case "meeting":
        case "standup":
          summary.totalMeetings += duration;
          summary.meetingsAttended++;
          break;
        case "review":
          summary.totalReviews += duration;
          summary.codeReviewsCompleted++;
          break;
        case "debugging":
          summary.totalDebugging += duration;
          break;
        case "docs":
          summary.totalDocs += duration;
          break;
        case "testing":
          summary.totalTesting += duration;
          break;
        default:
          summary.totalOther += duration;
      }
    }

    return summary;
  }

  getSessionStats(): SessionStats {
    const sessionDuration = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);

    const timeByType: Record<ActivityType, number> = {
      coding: 0,
      review: 0,
      debugging: 0,
      testing: 0,
      docs: 0,
      meeting: 0,
      planning: 0,
      standup: 0,
      break: 0,
      other: 0,
    };

    for (const activity of this.activities) {
      const duration = activity.duration || 0;
      timeByType[activity.type] = (timeByType[activity.type] || 0) + duration;
    }

    return {
      sessionDuration,
      currentActivity: this.currentActivity,
      activitiesToday: this.activities.length,
      timeByType,
      longestStreak: 0,
      breaksToday: this.activities.filter((a) => a.type === "break").length,
      calendarEventsToday: 0,
    };
  }

  async createGoal(description: string, type: "daily" | "weekly" | "sprint"): Promise<Goal> {
    const goal: Goal = {
      id: randomUUID(),
      description,
      type,
      status: "pending",
    };

    const goals = await this.store.loadGoals();
    goals.push(goal);
    await this.store.saveGoals(goals);
    return goal;
  }

  async updateGoalProgress(goalId: string, activityId: string): Promise<void> {
    const goals = await this.store.loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    if (!goal.activities) goal.activities = [];
    goal.activities.push(activityId);
    goal.status = "in-progress";

    await this.store.saveGoals(goals);
  }

  async completeGoal(goalId: string): Promise<void> {
    const goals = await this.store.loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    goal.status = "completed";
    goal.completedDate = new Date();

    await this.store.saveGoals(goals);
  }

  async getTodaysGoals(): Promise<Goal[]> {
    const goals = await this.store.loadGoals();
    const today = new Date().toISOString().split("T")[0];
    return goals.filter((g) => {
      if (g.type === "daily" && g.status !== "completed") return true;
      if (g.dueDate) {
        const dueDate = g.dueDate.toISOString().split("T")[0];
        return dueDate === today && g.status !== "completed";
      }
      return false;
    });
  }

  async getOverdueGoals(): Promise<Goal[]> {
    const goals = await this.store.loadGoals();
    const now = new Date();
    return goals.filter((g) => {
      if (g.status === "completed" || g.status === "missed") return false;
      if (!g.dueDate) return false;
      return g.dueDate < now;
    });
  }

  setTrackingMode(mode: "hybrid" | "explicit" | "implicit"): void {
    this.config.tracking.mode = mode;
    this.store.saveConfig(this.config);
  }

  getConfig(): AccountabilityConfig {
    return this.config;
  }
}
