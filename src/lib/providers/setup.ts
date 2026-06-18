import { registerProvider } from "./index";
import { createNvidiaProvider } from "./nvidia";
import { createOllamaProvider } from "./ollama";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // Order matters: tried first to last
  // Local Ollama is tried first (zero cost, private, offline-capable)
  registerProvider(createOllamaProvider());
  registerProvider(createNvidiaProvider());
}
