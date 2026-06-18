export type ProviderConfig = {
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream?: boolean;
};

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderResponse = {
  content: string;
  model: string;
  provider: string;
};

export interface LLMProvider {
  name: string;
  available(): Promise<boolean>;
  chat(messages: ProviderMessage[], config: ProviderConfig, signal?: AbortSignal): Promise<Response>;
}

// Provider chain: tries each provider in order until one works
const providerChain: LLMProvider[] = [];

export function registerProvider(provider: LLMProvider): void {
  providerChain.push(provider);
}

export function getProviders(): LLMProvider[] {
  return [...providerChain];
}

export async function chatWithFallback(
  messages: ProviderMessage[],
  config: ProviderConfig,
  signal?: AbortSignal,
): Promise<{ response: Response; provider: string; model: string }> {
  const errors: string[] = [];
  for (const provider of providerChain) {
    try {
      const available = await provider.available();
      if (!available) {
        errors.push(`${provider.name}: not available`);
        continue;
      }
      const res = await provider.chat(messages, config, signal);
      if (!res.ok) {
        const text = await res.text().catch(() => "unknown error");
        errors.push(`${provider.name}: ${res.status} ${text}`);
        continue;
      }
      console.log(`[Provider] Using ${provider.name}`);
      return { response: res, provider: provider.name, model: config.model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
    }
  }
  throw new Error(`All providers failed:\n${errors.join("\n")}`);
}
