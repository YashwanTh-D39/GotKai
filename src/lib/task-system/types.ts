export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskType = "chat" | "research" | "code" | "generate" | "reminder" | "workflow" | "custom";

export type Task = {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  prompt?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  scheduledFor?: number;
  recurring?: {
    interval: "hourly" | "daily" | "weekly" | "monthly" | "custom";
    customCron?: string;
    nextRun: number;
  };
  parentTaskId?: string;
  subtasks?: string[];
};

export type ScheduledTask = {
  id: string;
  title: string;
  type: TaskType;
  prompt: string;
  cron: string;
  enabled: boolean;
  lastRun?: number;
  nextRun: number;
  createdAt: number;
};

export type TaskEvent = {
  taskId: string;
  type: "progress" | "complete" | "error" | "cancel";
  progress?: number;
  result?: string;
  error?: string;
  timestamp: number;
};
