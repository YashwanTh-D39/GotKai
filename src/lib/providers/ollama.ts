import type { LLMProvider, ProviderMessage, ProviderConfig } from ".";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export type OllamaConfig = {
  baseUrl?: string;
  model?: string;
};

export function createOllamaProvider(config?: OllamaConfig): LLMProvider {
  const baseUrl = config?.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL;
  const defaultModel = config?.model || process.env.OLLAMA_MODEL || "llama3.2";

  return {
    name: "ollama",

    async available(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
      } catch {
        return false;
      }
    },

    async chat(
      messages: ProviderMessage[],
      config: ProviderConfig,
      signal?: AbortSignal,
    ): Promise<Response> {
      const model = config.model || defaultModel;
      const body = {
        model,
        messages,
        stream: config.stream !== false,
        options: {
          temperature: config.temperature ?? 0.3,
          top_p: config.top_p ?? 0.9,
          num_predict: config.max_tokens ?? 4096,
        },
      };

      // Ollama chat API returns NDJSON when streaming
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) return res;

      // Convert Ollama NDJSON stream to OpenAI-compatible SSE
      if (config.stream !== false) {
        const reader = res.body?.getReader();
        if (!reader) return res;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const decoder = new TextDecoder();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content) {
                      const sse = {
                        id: crypto.randomUUID?.() || "",
                        object: "chat.completion.chunk",
                        choices: [{
                          index: 0,
                          delta: { content: parsed.message.content },
                          finish_reason: parsed.done ? "stop" : null,
                        }],
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(sse)}\n\n`));
                    }
                    if (parsed.done) {
                      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    }
                  } catch {}
                }
              }
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }

      // Non-streaming: convert Ollama response to OpenAI format
      const data = await res.json();
      const oaiRes = {
        id: crypto.randomUUID?.() || "",
        object: "chat.completion",
        choices: [{
          index: 0,
          message: { role: "assistant", content: data.message?.content || "" },
          finish_reason: "stop",
        }],
        usage: data.usage || {},
      };

      return new Response(JSON.stringify(oaiRes), {
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}
