import { registerProvider } from "./index";
import { createNvidiaProvider } from "./nvidia";
import { createOllamaProvider } from "./ollama";
import { createGroqProvider } from "./groq";
import { createGeminiProvider } from "./gemini";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // Order matters: tried first to last
  // Local Ollama is tried first (zero cost, private, offline-capable)
  registerProvider(createOllamaProvider());
  registerProvider(createGroqProvider());
  registerProvider(createGeminiProvider());
  registerProvider(createNvidiaProvider());
}
