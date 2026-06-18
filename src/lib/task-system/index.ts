import { TaskQueue, registerExecutor } from "./queue";
export { TaskQueue } from "./queue";
export { registerExecutor } from "./queue";
export type { Task, TaskStatus, TaskPriority, TaskType, ScheduledTask, TaskEvent } from "./types";

// Register a default chat executor (runs a prompt through the API)
registerExecutor("chat", async function* (task) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: task.prompt || task.title }],
      agent: "reasoning",
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          yield delta;
        }
      } catch {}
    }
  }
});

// Helper to create a background research task
export function createResearchTask(query: string, priority: "low" | "medium" | "high" = "medium"): void {
  TaskQueue.add({
    type: "research",
    title: `Research: ${query.substring(0, 80)}`,
    prompt: `Research the following topic thoroughly and provide a comprehensive summary with key findings:\n\n${query}`,
    priority,
  });
}

// Helper to create a code generation task
export function createCodeTask(description: string): void {
  TaskQueue.add({
    type: "code",
    title: `Generate: ${description.substring(0, 80)}`,
    prompt: `Generate production-quality code for the following requirement:\n\n${description}`,
    priority: "medium",
  });
}
