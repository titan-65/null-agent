import type {
  Activity,
  ActivityType,
  DayReport,
  ActivitySummary,
  SessionStats,
  Goal,
} from "./types.ts";
import { AccountabilityStore } from "./storage.ts";
import { ActivityTracker } from "./tracker.ts";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export class Reporter {
  private store: AccountabilityStore;
  private tracker: ActivityTracker;

  constructor(store: AccountabilityStore, tracker: ActivityTracker) {
    this.store = store;
    this.tracker = tracker;
  }

  async generateDailyReport(date?: Date): Promise<DayReport> {
    const d = date || new Date();
    const dateStr = d.toISOString().split("T")[0]!;
    const activities = await this.store.loadActivities(d);
    const summary = await this.tracker.getActivitySummary(d);
    const goals = await this.tracker.getTodaysGoals();

    return {
      date: dateStr,
      activities,
      summary,
      goals,
    };
  }

  formatDailyReport(report: DayReport): string {
    const { activities, summary, goals, date } = report;

    const totalTime =
      summary.totalCoding +
      summary.totalMeetings +
      summary.totalReviews +
      summary.totalDebugging +
      summary.totalDocs +
      summary.totalTesting +
      summary.totalOther;

    let md = `# Daily Report - ${date}\n\n`;

    md += `## Summary\n`;
    md += `- **Active time:** ${formatDuration(totalTime)}\n`;
    md += `- **Activities:** ${activities.length}\n`;
    md += `- **Commits:** ${summary.commitsMade}\n`;
    md += `- **Code reviews:** ${summary.codeReviewsCompleted}\n\n`;

    md += `## Time Breakdown\n`;
    md += `| Activity | Time | % |\n`;
    md += `|----------|------|---|\n`;
    md += `| Coding | ${formatDuration(summary.totalCoding)} | ${formatPercent(summary.totalCoding, totalTime)} |\n`;
    md += `| Meetings | ${formatDuration(summary.totalMeetings)} | ${formatPercent(summary.totalMeetings, totalTime)} |\n`;
    md += `| Reviews | ${formatDuration(summary.totalReviews)} | ${formatPercent(summary.totalReviews, totalTime)} |\n`;
    md += `| Debugging | ${formatDuration(summary.totalDebugging)} | ${formatPercent(summary.totalDebugging, totalTime)} |\n`;
    md += `| Testing | ${formatDuration(summary.totalTesting)} | ${formatPercent(summary.totalTesting, totalTime)} |\n`;
    md += `| Docs | ${formatDuration(summary.totalDocs)} | ${formatPercent(summary.totalDocs, totalTime)} |\n`;
    md += `| Other | ${formatDuration(summary.totalOther)} | ${formatPercent(summary.totalOther, totalTime)} |\n\n`;

    md += `## Activities\n`;
    for (const activity of activities) {
      const start = formatTime(activity.startTime);
      const end = activity.endTime ? formatTime(activity.endTime) : "ongoing";
      md += `- ${start} - ${end}: ${activity.description} (${formatDuration(activity.duration || 0)})\n`;
    }
    md += `\n`;

    if (goals && goals.length > 0) {
      md += `## Goals\n`;
      for (const goal of goals) {
        const status = goal.status === "completed" ? "x" : " ";
        md += `- [${status}] ${goal.description}\n`;
      }
    }

    return md;
  }

  exportToMarkdown(report: DayReport): string {
    return this.formatDailyReport(report);
  }

  exportToCSV(report: DayReport): string {
    const { activities, date } = report;
    let csv = "date,activity,type,source,start_time,end_time,duration_seconds\n";

    for (const activity of activities) {
      csv += `${date},`;
      csv += `"${activity.description}",`;
      csv += `${activity.type},`;
      csv += `${activity.source},`;
      csv += `${activity.startTime.toISOString()},`;
      csv += `${activity.endTime ? activity.endTime.toISOString() : ""},`;
      csv += `${activity.duration || 0}\n`;
    }

    return csv;
  }

  exportToJSON(report: DayReport): string {
    return JSON.stringify(report, null, 2);
  }

  async getCurrentSessionStats(): Promise<SessionStats> {
    return this.tracker.getSessionStats();
  }

  formatSessionStats(stats: SessionStats): string {
    let text = `Session: ${formatDuration(stats.sessionDuration)}\n`;
    text += `Activities today: ${stats.activitiesToday}\n`;
    text += `Current: ${stats.currentActivity ? stats.currentActivity.description : "idle"}\n\n`;

    text += `Time by type:\n`;
    for (const [type, seconds] of Object.entries(stats.timeByType)) {
      if (seconds > 0) {
        text += `  ${type}: ${formatDuration(seconds)}\n`;
      }
    }

    return text;
  }
}
