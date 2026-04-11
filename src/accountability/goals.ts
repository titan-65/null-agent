import { randomUUID } from "node:crypto";
import type { Goal, GoalType, GoalStatus } from "./types.ts";
import { AccountabilityStore } from "./storage.ts";

export class GoalTracker {
  private store: AccountabilityStore;

  constructor(store: AccountabilityStore) {
    this.store = store;
  }

  async createGoal(description: string, type: GoalType, dueDate?: Date): Promise<Goal> {
    const goal: Goal = {
      id: randomUUID(),
      description,
      type,
      status: "pending",
      dueDate,
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
    if (!goal.activities.includes(activityId)) {
      goal.activities.push(activityId);
    }
    if (goal.status === "pending") {
      goal.status = "in-progress";
    }
    await this.store.saveGoals(goals);
  }

  async completeGoal(goalId: string): Promise<Goal | null> {
    const goals = await this.store.loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return null;
    goal.status = "completed";
    goal.completedDate = new Date();
    await this.store.saveGoals(goals);
    return goal;
  }

  async missGoal(goalId: string): Promise<void> {
    const goals = await this.store.loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.status = "missed";
    await this.store.saveGoals(goals);
  }

  async deleteGoal(goalId: string): Promise<void> {
    const goals = await this.store.loadGoals();
    await this.store.saveGoals(goals.filter((g) => g.id !== goalId));
  }

  async getAllGoals(): Promise<Goal[]> {
    return this.store.loadGoals();
  }

  async getTodaysGoals(): Promise<Goal[]> {
    const goals = await this.store.loadGoals();
    const today = new Date().toISOString().split("T")[0];
    return goals.filter((g) => {
      if (g.status === "completed" || g.status === "missed") return false;
      if (g.type === "daily") return true;
      if (g.dueDate) {
        const dueDate = new Date(g.dueDate).toISOString().split("T")[0];
        return dueDate === today;
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
      return new Date(g.dueDate) < now;
    });
  }

  async getGoalsByStatus(status: GoalStatus): Promise<Goal[]> {
    const goals = await this.store.loadGoals();
    return goals.filter((g) => g.status === status);
  }

  formatGoalList(goals: Goal[]): string {
    if (goals.length === 0) return "No goals found.";
    return goals
      .map((g) => {
        const icon =
          g.status === "completed"
            ? "✓"
            : g.status === "missed"
              ? "✗"
              : g.status === "in-progress"
                ? "⟳"
                : "○";
        const due = g.dueDate ? ` (due: ${new Date(g.dueDate).toLocaleDateString()})` : "";
        const shortId = g.id.slice(0, 8);
        return `${icon} [${shortId}] ${g.description}${due}`;
      })
      .join("\n");
  }
}
