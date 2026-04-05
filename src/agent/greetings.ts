export interface ContextualGreeting {
  message: string;
  context: GreetingContext;
}

export type GreetingContext =
  | "morning"
  | "afternoon"
  | "evening"
  | "returning"
  | "first_time"
  | "after_changes";

export interface GreetingOptions {
  projectName: string;
  gitBranch?: string;
  hasChanges?: boolean;
  changeCount?: number;
  isReturning?: boolean;
  lastConversationDate?: string;
}

export function generateGreeting(options: GreetingOptions): string {
  const timeGreeting = getTimeGreeting();
  const parts: string[] = [];

  if (options.isReturning && options.lastConversationDate) {
    const date = new Date(options.lastConversationDate);
    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAgo === 0) {
      parts.push("Welcome back!");
    } else if (daysAgo === 1) {
      parts.push("Welcome back! Good to see you again.");
    } else if (daysAgo < 7) {
      parts.push(`Welcome back! It's been ${daysAgo} days.`);
    } else {
      parts.push("Welcome back! It's been a while.");
    }
  } else {
    parts.push(timeGreeting);
  }

  // Project context
  parts.push(`I'm looking at ${options.projectName}`);

  if (options.gitBranch) {
    parts.push(`on ${options.gitBranch}`);
  }

  // Change awareness
  if (options.hasChanges && options.changeCount) {
    if (options.changeCount > 5) {
      parts.push(`— looks like you've been busy, ${options.changeCount} files changed!`);
    } else if (options.changeCount > 0) {
      parts.push(`— ${options.changeCount} file(s) modified`);
    }
  }

  // Proactive nudge
  if (options.hasChanges) {
    parts.push("Want me to take a look at the changes?");
  } else {
    parts.push("What can I help with?");
  }

  return parts.join(" ");
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 6) return "Burning the midnight oil?";
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  if (hour < 21) return "Good evening!";
  return "Working late?";
}

export function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour < 6 || hour >= 21) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
