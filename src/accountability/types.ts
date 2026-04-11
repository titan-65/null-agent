export type ActivityType =
  | "coding"
  | "review"
  | "debugging"
  | "testing"
  | "docs"
  | "meeting"
  | "planning"
  | "standup"
  | "break"
  | "other";

export type ActivitySource = "explicit" | "inferred" | "calendar" | "task-board";

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  source: ActivitySource;
  metadata?: {
    toolName?: string;
    filePath?: string;
    gitBranch?: string;
    commitHash?: string;
    calendarEventId?: string;
    taskId?: string;
  };
}

export interface ActivitySummary {
  totalCoding: number;
  totalMeetings: number;
  totalReviews: number;
  totalDebugging: number;
  totalDocs: number;
  totalTesting: number;
  totalOther: number;
  meetingsAttended: number;
  codeReviewsCompleted: number;
  issuesResolved: number;
  commitsMade: number;
}

export type GoalType = "daily" | "weekly" | "sprint";
export type GoalStatus = "pending" | "in-progress" | "completed" | "missed";

export interface Goal {
  id: string;
  description: string;
  type: GoalType;
  status: GoalStatus;
  dueDate?: Date;
  completedDate?: Date;
  activities?: string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  isRecurring: boolean;
  location?: string;
  description?: string;
}

export interface DayReport {
  date: string;
  activities: Activity[];
  summary: ActivitySummary;
  goals?: Goal[];
  reflections?: string;
  calendarEvents?: CalendarEvent[];
}

export interface WeeklyReport {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  dailyReports: DayReport[];
  summary: ActivitySummary;
  totalActiveDays: number;
  totalActivities: number;
}

export interface SessionStats {
  sessionDuration: number;
  currentActivity: Activity | null;
  activitiesToday: number;
  timeByType: Record<ActivityType, number>;
  longestStreak: number;
  breaksToday: number;
  calendarEventsToday: number;
}

export interface TrackingConfig {
  mode: "hybrid" | "explicit" | "implicit";
  autoInfer: boolean;
  idleThresholdMinutes: number;
  activityGroupingMinutes: number;
}

export interface ReminderConfig {
  upcomingMeetings: boolean;
  meetingReminderMinutes: number;
  breakReminders: boolean;
  breakThresholdMinutes: number;
  dailyStartSummary: boolean;
  dailyEndSummary: boolean;
  goalReminders: boolean;
}

export interface AccountabilityConfig {
  tracking: TrackingConfig;
  reminders: ReminderConfig;
}

export const DEFAULT_CONFIG: AccountabilityConfig = {
  tracking: {
    mode: "hybrid",
    autoInfer: true,
    idleThresholdMinutes: 30,
    activityGroupingMinutes: 5,
  },
  reminders: {
    upcomingMeetings: true,
    meetingReminderMinutes: 5,
    breakReminders: true,
    breakThresholdMinutes: 120,
    dailyStartSummary: true,
    dailyEndSummary: true,
    goalReminders: true,
  },
};
