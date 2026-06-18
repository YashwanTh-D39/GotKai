import type { LLMProvider, ProviderMessage, ProviderConfig } from ".";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FETCH_TIMEOUT = 30000;

function toGeminiMessages(messages: ProviderMessage[]) {
  const system: string[] = [];
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      system.push(m.content);
    } else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  const systemInstruction = system.length
    ? { parts: [{ text: system.join("\n") }] }
    : undefined;
  return { contents, systemInstruction };
}

export function createGeminiProvider(): LLMProvider {
  return {
    name: "gemini",

    async available(): Promise<boolean> {
      const key = process.env.GEMINI_API_KEY;
      return !!(key && key.length > 10);
    },

    async chat(
      messages: ProviderMessage[],
      config: ProviderConfig,
      signal?: AbortSignal,
    ): Promise<Response> {
      const apiKey = process.env.GEMINI_API_KEY!;
      const model = config.model || "gemini-2.0-flash";
      const { contents, systemInstruction } = toGeminiMessages(messages);

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: config.temperature ?? 0.3,
          topP: config.top_p ?? 0.9,
          maxOutputTokens: config.max_tokens ?? 4096,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      };
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT);
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      const streaming = config.stream !== false;
      const url = `${GEMINI_API_BASE}/${model}:${streaming ? "streamGenerateContent?alt=sse" : "generateContent"}?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });

      if (!res.ok || !streaming) return res;

      // Convert Gemini SSE → OpenAI SSE
      const reader = res.body?.getReader();
      if (!reader) return res;

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const stream = new ReadableStream({
        async start(controller) {
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
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
                try {
                  const geminiRes = JSON.parse(trimmed.slice(6));
                  const text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    const sse = {
                      id: crypto.randomUUID?.() || "",
                      object: "chat.completion.chunk",
                      choices: [{
                        index: 0,
                        delta: { content: text },
                        finish_reason: geminiRes.candidates?.[0]?.finishReason === "STOP" ? "stop" : null,
                      }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(sse)}\n\n`));
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
    },
  };
}
