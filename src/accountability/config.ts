import type { AccountabilityConfig, TrackingConfig, ReminderConfig } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { AccountabilityStore } from "./storage.ts";

export class AccountabilityConfigManager {
  private store: AccountabilityStore;
  private config: AccountabilityConfig = { ...DEFAULT_CONFIG };

  constructor(store: AccountabilityStore) {
    this.store = store;
  }

  async load(): Promise<AccountabilityConfig> {
    this.config = await this.store.loadConfig();
    return this.config;
  }

  async save(): Promise<void> {
    await this.store.saveConfig(this.config);
  }

  get(): AccountabilityConfig {
    return this.config;
  }

  async updateTracking(patch: Partial<TrackingConfig>): Promise<void> {
    this.config = {
      ...this.config,
      tracking: { ...this.config.tracking, ...patch },
    };
    await this.save();
  }

  async updateReminders(patch: Partial<ReminderConfig>): Promise<void> {
    this.config = {
      ...this.config,
      reminders: { ...this.config.reminders, ...patch },
    };
    await this.save();
  }

  async setTrackingMode(mode: TrackingConfig["mode"]): Promise<void> {
    await this.updateTracking({ mode });
  }

  async setBreakThreshold(minutes: number): Promise<void> {
    await this.updateReminders({ breakThresholdMinutes: minutes });
  }

  async toggleBreakReminders(enabled: boolean): Promise<void> {
    await this.updateReminders({ breakReminders: enabled });
  }

  async toggleMeetingReminders(enabled: boolean): Promise<void> {
    await this.updateReminders({ upcomingMeetings: enabled });
  }

  async toggleGoalReminders(enabled: boolean): Promise<void> {
    await this.updateReminders({ goalReminders: enabled });
  }

  async toggleDailyStartSummary(enabled: boolean): Promise<void> {
    await this.updateReminders({ dailyStartSummary: enabled });
  }

  reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    return this.save();
  }

  format(): string {
    const { tracking, reminders } = this.config;
    const lines = [
      "## Accountability Config",
      "",
      "### Tracking",
      `  mode: ${tracking.mode}`,
      `  autoInfer: ${tracking.autoInfer}`,
      `  idleThreshold: ${tracking.idleThresholdMinutes}m`,
      `  activityGrouping: ${tracking.activityGroupingMinutes}m`,
      "",
      "### Reminders",
      `  upcomingMeetings: ${reminders.upcomingMeetings} (${reminders.meetingReminderMinutes}m before)`,
      `  breakReminders: ${reminders.breakReminders} (after ${reminders.breakThresholdMinutes}m)`,
      `  goalReminders: ${reminders.goalReminders}`,
      `  dailyStartSummary: ${reminders.dailyStartSummary}`,
      `  dailyEndSummary: ${reminders.dailyEndSummary}`,
    ];
    return lines.join("\n");
  }
}
