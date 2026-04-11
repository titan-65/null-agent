export type TaskStatus = "todo" | "in-progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: Date;
  url?: string;
  labels?: string[];
}

export interface TaskBoardConfig {
  type: "jira" | "linear";
  apiKey?: string;
  baseUrl?: string;
  projectKey?: string;
  teamId?: string;
}

export interface TaskBoardIntegration {
  readonly type: "jira" | "linear";
  isEnabled: boolean;
  configure(config: TaskBoardConfig): Promise<void>;
  getMyTasks(): Promise<TaskItem[]>;
  getTasksInProgress(): Promise<TaskItem[]>;
  getTaskById(id: string): Promise<TaskItem | null>;
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
}

/**
 * Jira integration stub.
 * Full implementation requires: Jira Cloud API token + base URL + project key.
 */
export class JiraIntegration implements TaskBoardIntegration {
  readonly type = "jira" as const;
  isEnabled = false;
  private config: TaskBoardConfig | null = null;

  async configure(config: TaskBoardConfig): Promise<void> {
    if (config.type !== "jira") throw new Error("Config type must be 'jira'");
    this.config = config;
    this.isEnabled = true;
  }

  async getMyTasks(): Promise<TaskItem[]> {
    this.requireConfig();
    // TODO: GET /rest/api/3/search?jql=assignee=currentUser() AND status!=Done
    return [];
  }

  async getTasksInProgress(): Promise<TaskItem[]> {
    this.requireConfig();
    // TODO: GET /rest/api/3/search?jql=assignee=currentUser() AND status="In Progress"
    return [];
  }

  async getTaskById(id: string): Promise<TaskItem | null> {
    this.requireConfig();
    // TODO: GET /rest/api/3/issue/{id}
    void id;
    return null;
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    this.requireConfig();
    // TODO: POST /rest/api/3/issue/{id}/transitions
    void id;
    void status;
  }

  private requireConfig(): void {
    if (!this.config) {
      throw new Error("Jira not configured. Provide apiKey and baseUrl.");
    }
  }
}

/**
 * Linear integration stub.
 * Full implementation requires: Linear API key + team ID.
 */
export class LinearIntegration implements TaskBoardIntegration {
  readonly type = "linear" as const;
  isEnabled = false;
  private config: TaskBoardConfig | null = null;

  async configure(config: TaskBoardConfig): Promise<void> {
    if (config.type !== "linear") throw new Error("Config type must be 'linear'");
    this.config = config;
    this.isEnabled = true;
  }

  async getMyTasks(): Promise<TaskItem[]> {
    this.requireConfig();
    // TODO: Linear GraphQL API — viewer.assignedIssues
    return [];
  }

  async getTasksInProgress(): Promise<TaskItem[]> {
    this.requireConfig();
    // TODO: Linear GraphQL API — filter by state.type = "started"
    return [];
  }

  async getTaskById(id: string): Promise<TaskItem | null> {
    this.requireConfig();
    // TODO: Linear GraphQL API — issue(id: $id)
    void id;
    return null;
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    this.requireConfig();
    // TODO: Linear GraphQL mutation — updateIssue
    void id;
    void status;
  }

  private requireConfig(): void {
    if (!this.config) {
      throw new Error("Linear not configured. Provide apiKey and teamId.");
    }
  }
}
