export type MemoryCategory = "preference" | "fact" | "identity" | "learning" | "correction";
export type MemorySource = "explicit" | "inferred" | "feedback" | "extraction";

export type MemoryFact = {
  id: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  source: MemorySource;
  tags: string[];
  createdAt: number;
  lastUpdated: number;
  observedCount: number;
};

const STORAGE_KEY = "gotkai_memory_v2";
const CONFIDENCE_BOOST = 0.15;
const CONFIDENCE_DECAY = 0.02;
const MAX_MEMORIES = 200;

function loadFromStorage(): MemoryFact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMemory(memory: MemoryFact[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = memory.slice(0, MAX_MEMORIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function cosineSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const denom = Math.sqrt(setA.size) * Math.sqrt(setB.size);
  return denom === 0 ? 0 : intersection.size / denom;
}

function findSimilar(content: string, memory: MemoryFact[]): MemoryFact | null {
  let best: MemoryFact | null = null;
  let bestScore = 0;
  for (const fact of memory) {
    const score = cosineSimilarity(content, fact.content);
    if (score > 0.6 && score > bestScore) {
      best = fact;
      bestScore = score;
    }
  }
  return best;
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();
  const tagKeywords = [
    { words: ["like", "love", "enjoy", "prefer", "favorite"], tag: "preference" },
    { words: ["work", "job", "career", "company", "profession"], tag: "career" },
    { words: ["name", "called", "known"], tag: "identity" },
    { words: ["learn", "study", "research", "read"], tag: "learning" },
    { words: ["code", "program", "develop", "software", "app"], tag: "technology" },
    { words: ["health", "exercise", "diet", "fitness", "medication"], tag: "health" },
    { words: ["family", "friend", "wife", "husband", "child", "parent"], tag: "relationships" },
    { words: ["travel", "visit", "place", "city", "country"], tag: "travel" },
    { words: ["music", "song", "band", "artist", "album"], tag: "music" },
    { words: ["movie", "film", "show", "series", "netflix"], tag: "entertainment" },
  ];
  for (const { words, tag } of tagKeywords) {
    if (words.some((w) => lower.includes(w))) {
      tags.push(tag);
    }
  }
  return tags;
}

export function addMemoryFact(
  content: string,
  category: MemoryCategory = "fact",
  source: MemorySource = "explicit",
): void {
  const memory = loadFromStorage();
  const existing = findSimilar(content, memory);

  if (existing) {
    existing.observedCount += 1;
    existing.lastUpdated = Date.now();
    existing.confidence = Math.min(1, existing.confidence + CONFIDENCE_BOOST * (1 - existing.confidence));
    if (source === "explicit" || source === "feedback") {
      existing.source = source;
    }
    saveMemory(memory);
    return;
  }

  const fact: MemoryFact = {
    id: crypto.randomUUID(),
    category,
    content: content.charAt(0).toUpperCase() + content.slice(1),
    confidence: source === "explicit" ? 0.7 : source === "feedback" ? 0.8 : 0.4,
    source,
    tags: extractTags(content),
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    observedCount: 1,
  };
  memory.unshift(fact);
  saveMemory(memory);
}

export function removeMemory(id: string): void {
  const memory = loadFromStorage().filter((f) => f.id !== id);
  saveMemory(memory);
}

export function updateMemory(id: string, updates: Partial<Pick<MemoryFact, "content" | "category" | "tags">>): void {
  const memory = loadFromStorage().map((f) =>
    f.id === id ? { ...f, ...updates, lastUpdated: Date.now() } : f,
  );
  saveMemory(memory);
}

export function searchMemories(query: string): MemoryFact[] {
  const memory = loadFromStorage();
  if (!query.trim()) return memory;
  const lower = query.toLowerCase();
  return memory.filter(
    (f) =>
      f.content.toLowerCase().includes(lower) ||
      f.tags.some((t) => t.includes(lower)) ||
      f.category.includes(lower),
  );
}

export function getMemoriesByCategory(category?: MemoryCategory): MemoryFact[] {
  const memory = loadFromStorage();
  return category ? memory.filter((f) => f.category === category) : memory;
}

export function getHighConfidenceMemories(threshold = 0.5): MemoryFact[] {
  return loadFromStorage().filter((f) => f.confidence >= threshold);
}

export function getMemoryContext(minConfidence = 0.4): string {
  const memory = getHighConfidenceMemories(minConfidence);
  if (memory.length === 0) return "";
  const lines = memory
    .sort((a, b) => b.confidence - a.confidence)
    .map((f) => `- ${f.content} (${Math.round(f.confidence * 100)}% confident)`);
  return `\n\n--- What I know about the user ---\n${lines.join("\n")}\n---\n`;
}

export function clearMemory(): void {
  saveMemory([]);
}

export function getMemoryStats(): { total: number; byCategory: Record<string, number>; avgConfidence: number } {
  const memory = loadFromStorage();
  const byCategory: Record<string, number> = {};
  let totalConfidence = 0;
  for (const f of memory) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    totalConfidence += f.confidence;
  }
  return {
    total: memory.length,
    byCategory,
    avgConfidence: memory.length > 0 ? totalConfidence / memory.length : 0,
  };
}

// Periodic confidence decay (run on extraction to age old, low-confidence facts)
function decayConfidence(): void {
  const memory = loadFromStorage();
  const now = Date.now();
  let changed = false;
  for (const f of memory) {
    const daysSinceUpdate = (now - f.lastUpdated) / 86400000;
    if (daysSinceUpdate > 7 && f.observedCount < 2) {
      f.confidence = Math.max(0, f.confidence - CONFIDENCE_DECAY * daysSinceUpdate);
      changed = true;
    }
  }
  if (changed) saveMemory(memory);
}

// LLM-based extraction — sent periodically with conversation summaries
let lastExtractionTime = 0;
const EXTRACTION_COOLDOWN = 30000; // only extract every 30 seconds at most

export async function extractWithLLM(messages: { role: string; content: string }[]): Promise<void> {
  decayConfidence();
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  // Always run regex extraction as a fallback
  for (const content of userMessages) {
    extractBasic(content);
  }

  // LLM extraction: only if enough time has passed and there's meaningful content
  const now = Date.now();
  if (now - lastExtractionTime < EXTRACTION_COOLDOWN) return;
  const lastUserMsg = userMessages[userMessages.length - 1] || "";
  if (lastUserMsg.length < 10 || /^(yes|no|ok|thanks|sure|okay|hey|hello|hi)\b/i.test(lastUserMsg.trim())) return;

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-6) }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.facts && Array.isArray(data.facts)) {
      for (const fact of data.facts) {
        addMemoryFact(fact.content, fact.category as MemoryCategory, "extraction");
      }
      lastExtractionTime = now;
    }
  } catch {
    // Silently fail — regex extraction is still running as a fallback
  }
}

const BASIC_PATTERNS: { match: RegExp; category: MemoryCategory }[] = [
  { match: /(?:i\s+(?:am|'m)\s+(\w+(?:\s+\w+){0,2}))/i, category: "identity" },
  { match: /(?:my\s+name\s+(?:is|'s)\s+(\w+(?:\s+\w+){0,2}))/i, category: "identity" },
  { match: /(?:i\s+(?:like|love|enjoy|prefer)\s+(\w+(?:\s+\w+){0,5}))/i, category: "preference" },
  { match: /(?:i\s+work\s+(?:as|at|for)\s+(\w+(?:\s+\w+){0,3}))/i, category: "fact" },
  { match: /(?:i\s+(?:am\s+a|'m\s+a)\s+(\w+(?:\s+\w+){0,3}))/i, category: "identity" },
  { match: /(?:i\s+use\s+(\w+(?:\s+\w+){0,3}))/i, category: "fact" },
  { match: /(?:i\s+(?:need|want|would\s+like)\s+(\w+(?:\s+\w+){0,5}))/i, category: "preference" },
  { match: /(?:i\s+don't\s+(?:like|want|need|prefer)\s+(\w+(?:\s+\w+){0,5}))/i, category: "correction" },
  { match: /(?:my\s+favorite\s+(\w+(?:\s+\w+){0,5})\s+is\s+(\w+(?:\s+\w+){0,3}))/i, category: "preference" },
  { match: /(?:i\s+live\s+(?:in|at)\s+(\w+(?:\s+\w+){0,3}))/i, category: "fact" },
  { match: /(?:i\s+stud(y|ied)\s+(\w+(?:\s+\w+){0,3}))/i, category: "fact" },
  { match: /(?:i\s+learn(?:ed|ing)\s+(\w+(?:\s+\w+){0,5}))/i, category: "learning" },
];

function extractBasic(content: string): void {
  const lower = content;
  for (const { match, category } of BASIC_PATTERNS) {
    const m = lower.match(match);
    if (m) {
      addMemoryFact(m[0], category, "inferred");
    }
  }
}

export { loadFromStorage as loadMemories, saveMemory as saveMemories };
