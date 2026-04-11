import type { Activity, Goal, ActivityType, AccountabilityConfig } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { ActivityTracker } from "./tracker.ts";

export interface Notification {
  type: string;
  message: string;
  timestamp: Date;
  priority: "low" | "medium" | "high";
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export class Accountant {
  private tracker: ActivityTracker;
  private config: AccountabilityConfig;
  private lastNotificationTime: Map<string, number> = new Map();
  private notificationCooldown = 5 * 60 * 1000;

  constructor(tracker: ActivityTracker, config?: Partial<AccountabilityConfig>) {
    this.tracker = tracker;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  checkUpcomingMeetings(): Notification[] {
    if (!this.config.reminders.upcomingMeetings) return [];

    const notifications: Notification[][] = [];
    const now = Date.now();
    const reminderKey = "meeting-reminder";
    const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

    if (now - lastTime < this.notificationCooldown) return [];

    return notifications.flat();
  }

  async checkGoalProgress(): Promise<Notification[]> {
    if (!this.config.reminders.goalReminders) return [];

    const notifications: Notification[] = [];
    const goals = await this.tracker.getTodaysGoals();
    const overdueGoals = await this.tracker.getOverdueGoals();

    for (const goal of overdueGoals) {
      notifications.push({
        type: "goal:overdue",
        message: `Goal overdue: "${goal.description}"`,
        timestamp: new Date(),
        priority: "high",
      });
    }

    if (goals.length > 0 && goals.every((g) => g.status === "pending")) {
      const now = Date.now();
      const reminderKey = "goal-reminder";
      const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

      if (now - lastTime > this.notificationCooldown) {
        notifications.push({
          type: "goal:reminder",
          message: `You have ${goals.length} goals for today. Get started!`,
          timestamp: new Date(),
          priority: "medium",
        });
        this.lastNotificationTime.set(reminderKey, now);
      }
    }

    return notifications;
  }

  async checkActivityPatterns(): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const stats = this.tracker.getSessionStats();
    const now = Date.now();

    if (this.config.reminders.breakReminders) {
      const breakThresholdSeconds = this.config.reminders.breakThresholdMinutes * 60;
      const totalActiveTime = stats.timeByType["coding"] + stats.timeByType["debugging"];

      if (totalActiveTime > breakThresholdSeconds) {
        const reminderKey = "break-reminder";
        const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

        if (now - lastTime > this.notificationCooldown) {
          notifications.push({
            type: "time:threshold",
            message: `You've been active for ${formatDuration(totalActiveTime)}. Consider taking a break!`,
            timestamp: new Date(),
            priority: "medium",
          });
          this.lastNotificationTime.set(reminderKey, now);
        }
      }
    }

    const currentActivity = this.tracker.getCurrentActivity();
    if (currentActivity && currentActivity.type === "debugging") {
      const duration = (now - currentActivity.startTime.getTime()) / 1000;
      if (duration > 3600) {
        const reminderKey = "debug-reminder";
        const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

        if (now - lastTime > this.notificationCooldown) {
          notifications.push({
            type: "time:milestone",
            message: `You've been debugging for ${formatDuration(duration)}. Maybe ask for help?`,
            timestamp: new Date(),
            priority: "medium",
          });
          this.lastNotificationTime.set(reminderKey, now);
        }
      }
    }

    return notifications;
  }

  checkDailyRituals(): Notification[] {
    if (!this.config.reminders.dailyStartSummary) return [];

    const notifications: Notification[] = [];
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 9 && hour <= 10) {
      const reminderKey = "morning-check";
      const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

      if (Date.now() - lastTime > 24 * 60 * 60 * 1000) {
        notifications.push({
          type: "daily:start",
          message: "Good morning! Time to check your tasks and plan the day.",
          timestamp: now,
          priority: "low",
        });
        this.lastNotificationTime.set(reminderKey, Date.now());
      }
    }

    if (hour >= 17 && hour <= 18) {
      const reminderKey = "evening-check";
      const lastTime = this.lastNotificationTime.get(reminderKey) || 0;

      if (Date.now() - lastTime > 24 * 60 * 60 * 1000) {
        notifications.push({
          type: "daily:end",
          message: "Day is ending! Want to see your daily summary?",
          timestamp: now,
          priority: "low",
        });
        this.lastNotificationTime.set(reminderKey, Date.now());
      }
    }

    return notifications;
  }

  challengeUser(goal: Goal): string {
    if (goal.status === "pending") {
      return `You said you'd "${goal.description}" today. Haven't seen any progress yet!`;
    }
    if (goal.status === "in-progress") {
      return `Good progress on "${goal.description}"! Keep going!`;
    }
    return `Goal "${goal.description}" is ${goal.status}.`;
  }

  celebrateWin(activity: Activity): string {
    switch (activity.type) {
      case "coding":
        return `Great work! You spent ${formatDuration(activity.duration || 0)} coding.`;
      case "review":
        return `Nice review session! Code quality matters.`;
      case "debugging":
        return `Bug squashed! ${formatDuration(activity.duration || 0)} of debugging done.`;
      case "testing":
        return `Tests passed! Your code is solid.`;
      default:
        return `Activity completed: ${activity.description}`;
    }
  }

  suggestBreak(): string {
    const stats = this.tracker.getSessionStats();
    const activeTime = stats.timeByType["coding"] + stats.timeByType["debugging"];

    if (activeTime > 2 * 60 * 60) {
      return "You've been coding for over 2 hours. Take a 10-minute break!";
    }
    if (activeTime > 60 * 60) {
      return "Good coding session! Consider a short break soon.";
    }
    return "Keep up the good work!";
  }

  async getDailySummary(): Promise<string> {
    const stats = await this.tracker.getSessionStats();
    const goals = await this.tracker.getTodaysGoals();

    let summary = `Today's Progress:\n`;
    summary += `- Session: ${formatDuration(stats.sessionDuration)}\n`;
    summary += `- Activities: ${stats.activitiesToday}\n`;
    summary += `- Coding: ${formatDuration(stats.timeByType["coding"])}\n`;
    summary += `- Meetings: ${formatDuration(stats.timeByType["meeting"])}\n`;
    summary += `- Reviews: ${formatDuration(stats.timeByType["review"])}\n`;

    if (goals.length > 0) {
      const completed = goals.filter((g) => g.status === "completed").length;
      summary += `\nGoals: ${completed}/${goals.length} completed\n`;
    }

    return summary;
  }
}
