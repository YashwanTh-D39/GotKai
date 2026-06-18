import type { LLMProvider, ProviderMessage, ProviderConfig } from ".";

export const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const FETCH_TIMEOUT = 30000;

export function createNvidiaProvider(): LLMProvider {
  return {
    name: "nvidia",

    async available(): Promise<boolean> {
      const apiKey = process.env.NVIDIA_NIM_API_KEY;
      return !!(apiKey && apiKey !== "your_nvidia_nim_api_key_here");
    },

    async chat(
      messages: ProviderMessage[],
      config: ProviderConfig,
      signal?: AbortSignal,
    ): Promise<Response> {
      const apiKey = process.env.NVIDIA_NIM_API_KEY!;

      const body = {
        model: config.model || "meta/llama-3.1-70b-instruct",
        messages,
        temperature: config.temperature ?? 0.3,
        top_p: config.top_p ?? 0.9,
        max_tokens: config.max_tokens ?? 4096,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stream: config.stream !== false,
      };

      // Combine user signal with a timeout so the request doesn't hang forever
      const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT);
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      return fetch(NVIDIA_URL, {
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
