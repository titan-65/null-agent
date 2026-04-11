import type { CalendarEvent } from "../types.ts";

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Google Calendar integration.
 *
 * Phase 4 implementation — OAuth 2.0 + Calendar API.
 * Currently stubbed: token storage and event polling are wired up,
 * but actual Google API calls require client credentials.
 *
 * Setup: `null-agent auth google` (guides through OAuth flow).
 */
export class GoogleCalendarIntegration {
  readonly type = "google-calendar" as const;
  readonly name = "Google Calendar";

  isEnabled = false;
  isAuthenticated = false;

  private tokens: GoogleCalendarTokens | null = null;
  private cachedEvents: CalendarEvent[] = [];
  private lastSync: Date | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  configure(tokens: GoogleCalendarTokens): void {
    this.tokens = tokens;
    this.isEnabled = true;
    this.isAuthenticated = true;
  }

  async authenticate(): Promise<void> {
    // OAuth 2.0 device/redirect flow.
    // Full implementation requires:
    //   1. Google Cloud OAuth2 client credentials (client_id, client_secret)
    //   2. Redirect URI or device-code flow
    //   3. Token storage via the null-agent credential system
    throw new Error(
      "Google Calendar OAuth not yet configured.\n" +
        "Run: null-agent auth google\n" +
        "Then follow the browser OAuth flow and grant Calendar read access.",
    );
  }

  async disconnect(): Promise<void> {
    this.tokens = null;
    this.isEnabled = false;
    this.isAuthenticated = false;
    this.stopWatching();
  }

  async getEvents(date: Date): Promise<CalendarEvent[]> {
    this.requireAuth();
    const dateStr = date.toISOString().split("T")[0];
    return this.cachedEvents.filter((e) => {
      return new Date(e.startTime).toISOString().split("T")[0] === dateStr;
    });
  }

  async getEventsInRange(start: Date, end: Date): Promise<CalendarEvent[]> {
    this.requireAuth();
    return this.cachedEvents.filter((e) => {
      const t = new Date(e.startTime).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }

  /**
   * Poll Google Calendar every `intervalMinutes` minutes.
   * Calls `onEvents` whenever events are returned for today.
   */
  watchCalendar(onEvents: (events: CalendarEvent[]) => void, intervalMinutes = 5): void {
    this.stopWatching();
    this.pollInterval = setInterval(
      async () => {
        if (!this.isAuthenticated) return;
        try {
          const today = new Date();
          const events = await this.getEvents(today);
          this.lastSync = new Date();
          if (events.length > 0) {
            onEvents(events);
          }
        } catch {
          // Sync error — continue polling
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  stopWatching(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getUpcomingEvents(withinMinutes: number): CalendarEvent[] {
    const now = Date.now();
    const cutoff = now + withinMinutes * 60 * 1000;
    return this.cachedEvents.filter((e) => {
      const t = new Date(e.startTime).getTime();
      return t >= now && t <= cutoff;
    });
  }

  getLastSyncTime(): Date | null {
    return this.lastSync;
  }

  isWatching(): boolean {
    return this.pollInterval !== null;
  }

  /** Inject events directly (for testing or manual cache warm-up). */
  injectEvents(events: CalendarEvent[]): void {
    this.cachedEvents = [...events];
    this.lastSync = new Date();
  }

  private requireAuth(): void {
    if (!this.isAuthenticated || !this.tokens) {
      throw new Error("Google Calendar is not authenticated. Run: null-agent auth google");
    }
  }
}
