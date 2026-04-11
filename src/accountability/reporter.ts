import type { DayReport, WeeklyReport, ActivitySummary, SessionStats } from "./types.ts";
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

  async generateWeeklyReport(weekStart: Date): Promise<WeeklyReport> {
    // Normalize to Monday of the given week
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const weekEnd = new Date(start);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const dailyReports: DayReport[] = [];
    const current = new Date(start);
    while (current <= weekEnd) {
      const report = await this.generateDailyReport(new Date(current));
      dailyReports.push(report);
      current.setDate(current.getDate() + 1);
    }

    const summary = aggregateSummaries(dailyReports.map((r) => r.summary));
    const totalActivities = dailyReports.reduce((sum, r) => sum + r.activities.length, 0);
    const totalActiveDays = dailyReports.filter((r) => r.activities.length > 0).length;

    return {
      weekStart: start.toISOString().split("T")[0]!,
      weekEnd: weekEnd.toISOString().split("T")[0]!,
      dailyReports,
      summary,
      totalActiveDays,
      totalActivities,
    };
  }

  formatWeeklyReport(report: WeeklyReport): string {
    const { weekStart, weekEnd, summary, totalActiveDays, totalActivities, dailyReports } = report;

    const totalTime =
      summary.totalCoding +
      summary.totalMeetings +
      summary.totalReviews +
      summary.totalDebugging +
      summary.totalDocs +
      summary.totalTesting +
      summary.totalOther;

    let md = `# Weekly Report — ${weekStart} to ${weekEnd}\n\n`;
    md += `## Summary\n`;
    md += `- **Active days:** ${totalActiveDays}/7\n`;
    md += `- **Total activities:** ${totalActivities}\n`;
    md += `- **Total active time:** ${formatDuration(totalTime)}\n`;
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

    md += `## Daily Breakdown\n\n`;
    for (const day of dailyReports) {
      const dayTotal =
        day.summary.totalCoding +
        day.summary.totalMeetings +
        day.summary.totalReviews +
        day.summary.totalDebugging +
        day.summary.totalDocs +
        day.summary.totalTesting +
        day.summary.totalOther;
      if (dayTotal === 0 && day.activities.length === 0) continue;
      md += `### ${day.date}\n`;
      md += `- Activities: ${day.activities.length} · Active: ${formatDuration(dayTotal)}\n`;
      if (day.summary.commitsMade > 0) md += `- Commits: ${day.summary.commitsMade}\n`;
      md += `\n`;
    }

    return md;
  }

  async saveReport(report: DayReport): Promise<void> {
    const markdown = this.formatDailyReport(report);
    await this.store.saveDailyReport(report.date, report, markdown);
  }

  async saveWeeklyReport(report: WeeklyReport): Promise<void> {
    const markdown = this.formatWeeklyReport(report);
    // Week label: e.g. "2026-w15"
    const weekDate = new Date(report.weekStart);
    const weekNum = getWeekNumber(weekDate);
    const label = `${weekDate.getFullYear()}-w${String(weekNum).padStart(2, "0")}`;
    await this.store.saveWeeklyReport(label, markdown);
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

function aggregateSummaries(summaries: ActivitySummary[]): ActivitySummary {
  const result: ActivitySummary = {
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
  for (const s of summaries) {
    result.totalCoding += s.totalCoding;
    result.totalMeetings += s.totalMeetings;
    result.totalReviews += s.totalReviews;
    result.totalDebugging += s.totalDebugging;
    result.totalDocs += s.totalDocs;
    result.totalTesting += s.totalTesting;
    result.totalOther += s.totalOther;
    result.meetingsAttended += s.meetingsAttended;
    result.codeReviewsCompleted += s.codeReviewsCompleted;
    result.issuesResolved += s.issuesResolved;
    result.commitsMade += s.commitsMade;
  }
  return result;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
