import type { Task, TaskEvent, TaskPriority, TaskType, TaskStatus } from "./types";

const TASK_STORAGE_KEY = "gotkai_tasks";
const MAX_CONCURRENT = 2;

let taskListeners: Array<(event: TaskEvent) => void> = [];
let activeCount = 0;

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

function notify(event: TaskEvent): void {
  for (const listener of taskListeners) {
    try { listener(event); } catch {}
  }
}

const executorMap = new Map<string, (task: Task) => AsyncIterable<string>>();

export function registerExecutor(type: TaskType, executor: (task: Task) => AsyncIterable<string>): void {
  executorMap.set(type, executor);
}

export const TaskQueue = {
  subscribe(listener: (event: TaskEvent) => void): () => void {
    taskListeners.push(listener);
    return () => {
      taskListeners = taskListeners.filter((l) => l !== listener);
    };
  },

  add(task: Omit<Task, "id" | "status" | "progress" | "createdAt">): Task {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
    };
    const tasks = loadTasks();
    tasks.unshift(newTask);
    saveTasks(tasks);
    notify({ taskId: newTask.id, type: "progress", progress: 0, timestamp: Date.now() });
    TaskQueue.processNext();
    return newTask;
  },

  getAll(): Task[] {
    return loadTasks();
  },

  getById(id: string): Task | undefined {
    return loadTasks().find((t) => t.id === id);
  },

  update(id: string, updates: Partial<Task>): void {
    const tasks = loadTasks().map((t) => (t.id === id ? { ...t, ...updates } : t));
    saveTasks(tasks);
  },

  cancel(id: string): void {
    const tasks = loadTasks().map((t) =>
      t.id === id ? { ...t, status: "cancelled" as TaskStatus } : t,
    );
    saveTasks(tasks);
    notify({ taskId: id, type: "cancel", timestamp: Date.now() });
  },

  clearCompleted(): void {
    const tasks = loadTasks().filter((t) => t.status === "running" || t.status === "pending");
    saveTasks(tasks);
  },

  async processNext(): Promise<void> {
    if (activeCount >= MAX_CONCURRENT) return;
    const tasks = loadTasks();
    const next = tasks.find(
      (t) => t.status === "pending" && (!t.scheduledFor || t.scheduledFor <= Date.now()),
    );
    if (!next) return;

    activeCount++;
    TaskQueue.update(next.id, { status: "running", startedAt: Date.now() });

    try {
      const executor = executorMap.get(next.type);
      if (!executor) {
        TaskQueue.update(next.id, { status: "failed", error: `No executor for type: ${next.type}` });
        notify({ taskId: next.id, type: "error", error: `No executor for type: ${next.type}`, timestamp: Date.now() });
        return;
      }

      const stream = executor(next);
      let result = "";
      for await (const chunk of stream) {
        result += chunk;
        const progress = Math.min((result.length / 500) * 100, 95);
        TaskQueue.update(next.id, { progress, result });
        notify({ taskId: next.id, type: "progress", progress, result: chunk, timestamp: Date.now() });
      }

      TaskQueue.update(next.id, { status: "completed", progress: 100, result, completedAt: Date.now() });
      notify({ taskId: next.id, type: "complete", result, timestamp: Date.now() });

      // Handle recurring tasks
      if (next.recurring) {
        const intervalMs = getIntervalMs(next.recurring.interval);
        const newTask: Task = {
          ...next,
          id: crypto.randomUUID(),
          status: "pending",
          progress: 0,
          result: undefined,
          completedAt: undefined,
          startedAt: undefined,
          createdAt: Date.now(),
          scheduledFor: Date.now() + intervalMs,
        };
        const allTasks = loadTasks();
        allTasks.unshift(newTask);
        saveTasks(allTasks);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      TaskQueue.update(next.id, { status: "failed", error: msg });
      notify({ taskId: next.id, type: "error", error: msg, timestamp: Date.now() });
    } finally {
      activeCount--;
      TaskQueue.processNext();
    }
  },
};

function getIntervalMs(interval: string): number {
  switch (interval) {
    case "hourly": return 3600000;
    case "daily": return 86400000;
    case "weekly": return 604800000;
    case "monthly": return 2592000000;
    default: return 86400000;
  }
}

// Periodic scheduler check
if (typeof window !== "undefined") {
  setInterval(() => {
    TaskQueue.processNext();
  }, 30000);
}
