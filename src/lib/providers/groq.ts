import type { LLMProvider, ProviderMessage, ProviderConfig } from ".";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const FETCH_TIMEOUT = 30000;

export function createGroqProvider(): LLMProvider {
  return {
    name: "groq",

    async available(): Promise<boolean> {
      const apiKey = process.env.GROQ_API_KEY;
      return !!(apiKey && apiKey.startsWith("gsk_"));
    },

    async chat(
      messages: ProviderMessage[],
      config: ProviderConfig,
      signal?: AbortSignal,
    ): Promise<Response> {
      const apiKey = process.env.GROQ_API_KEY!;

      const body = {
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: config.temperature ?? 0.3,
        top_p: config.top_p ?? 0.9,
        max_tokens: config.max_tokens ?? 4096,
        stream: config.stream !== false,
      };

      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT);
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      return fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    },
  };
}
