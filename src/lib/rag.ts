export type SourceType = "file" | "webpage" | "youtube";

export type TextChunk = {
  id: string;
  docId: string;
  docName: string;
  sourceType: SourceType;
  sourceUrl?: string;
  index: number;
  text: string;
};

export type IndexedDocument = {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceUrl?: string;
  chunkCount: number;
  totalSize: number;
  indexedAt: number;
};

type TokenIndex = Map<string, Set<string>>;
type DocEntry = {
  info: IndexedDocument;
  chunks: TextChunk[];
  index: TokenIndex;
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const MAX_CONTEXT_CHUNKS = 5;

const docIndex = new Map<string, DocEntry>();

// ── IndexedDB Persistence ───────────────────────────────

const RAG_DB = "gotkai_rag";
const RAG_STORE = "documents";

function openRagDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RAG_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RAG_STORE, { keyPath: "docId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type StoredDoc = {
  docId: string;
  info: IndexedDocument;
  chunks: TextChunk[];
};

let initPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (!initPromise) {
    initPromise = loadFromStorage();
  }
  await initPromise;
}

async function loadFromStorage(): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  try {
    const db = await openRagDB();
    const docs: StoredDoc[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(RAG_STORE, "readonly");
      const req = tx.objectStore(RAG_STORE).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    for (const stored of docs) {
      const entry: DocEntry = {
        info: stored.info,
        chunks: stored.chunks,
        index: buildIndex(stored.chunks),
      };
      docIndex.set(stored.docId, entry);
    }
  } catch (e) {
    console.warn("RAG: failed to load from IndexedDB, starting fresh", e);
  }
}

async function saveToStorage(): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  try {
    const db = await openRagDB();
    const tx = db.transaction(RAG_STORE, "readwrite");
    const store = tx.objectStore(RAG_STORE);
    store.clear();
    for (const [docId, entry] of docIndex) {
      const stored: StoredDoc = { docId, info: entry.info, chunks: entry.chunks };
      store.put(stored);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("RAG: failed to save to IndexedDB", e);
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildIndex(chunks: TextChunk[]): TokenIndex {
  const index: TokenIndex = new Map();
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const unique = new Set(tokens);
    for (const t of unique) {
      if (!index.has(t)) index.set(t, new Set());
      index.get(t)!.add(chunk.id);
    }
  }
  return index;
}

export function chunkText(text: string, docId: string, docName: string, sourceType: SourceType = "file", sourceUrl?: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";
  let idx = 0;
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (current.length + trimmed.length > CHUNK_SIZE && current.length > 0) {
      const overlap = current.slice(-CHUNK_OVERLAP);
      chunks.push({ id: `${docId}_${idx}`, docId, docName, sourceType, sourceUrl, index: idx, text: current });
      idx++;
      current = overlap + "\n\n" + trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }
  if (current.trim()) {
    chunks.push({ id: `${docId}_${idx}`, docId, docName, sourceType, sourceUrl, index: idx, text: current });
  }
  return chunks;
}

export async function indexDocument(
  chunks: TextChunk[],
  info?: { sourceType: SourceType; sourceUrl?: string },
): Promise<void> {
  await ensureLoaded();
  const chunk = chunks[0];
  if (!chunk) return;
  const docId = chunk.docId;
  const entry: DocEntry = {
    info: {
      id: docId,
      name: chunk.docName,
      sourceType: info?.sourceType || chunk.sourceType || "file",
      sourceUrl: info?.sourceUrl || chunk.sourceUrl,
      chunkCount: chunks.length,
      totalSize: chunks.reduce((s, c) => s + c.text.length, 0),
      indexedAt: Date.now(),
    },
    chunks,
    index: buildIndex(chunks),
  };
  docIndex.set(docId, entry);
  await saveToStorage();
}

export async function removeDocument(docId: string): Promise<void> {
  await ensureLoaded();
  docIndex.delete(docId);
  await saveToStorage();
}

export async function getDocumentList(): Promise<IndexedDocument[]> {
  await ensureLoaded();
  return Array.from(docIndex.values())
    .map((e) => e.info)
    .sort((a, b) => b.indexedAt - a.indexedAt);
}

export async function clearAllDocuments(): Promise<void> {
  await ensureLoaded();
  docIndex.clear();
  await saveToStorage();
}

function scoreChunks(query: string, entry: DocEntry): { chunk: TextChunk; score: number }[] {
  const queryTokens = tokenize(query);
  const scores = new Map<string, { chunk: TextChunk; score: number }>();
  for (const qt of queryTokens) {
    const matching = entry.index.get(qt);
    if (!matching) continue;
    const idf = Math.log((entry.chunks.length + 1) / (matching.size + 1)) + 1;
    for (const chunkId of matching) {
      const chunk = entry.chunks.find((c) => c.id === chunkId);
      if (!chunk) continue;
      const tf = (chunk.text.toLowerCase().match(new RegExp(qt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      const prev = scores.get(chunkId);
      const currentScore = prev ? prev.score : 0;
      scores.set(chunkId, { chunk, score: currentScore + (tf / (1 + tf)) * idf });
    }
  }
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_CHUNKS);
}

export async function searchRelevant(
  query: string,
  options?: { docIds?: string[]; sourceTypes?: SourceType[]; maxResults?: number },
): Promise<TextChunk[]> {
  await ensureLoaded();
  const maxResults = options?.maxResults || MAX_CONTEXT_CHUNKS;
  const results: { chunk: TextChunk; score: number }[] = [];
  for (const [id, entry] of docIndex) {
    if (options?.docIds && !options.docIds.includes(id)) continue;
    if (options?.sourceTypes && !options.sourceTypes.includes(entry.info.sourceType)) continue;
    results.push(...scoreChunks(query, entry));
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((r) => r.chunk);
}

export function formatContext(chunks: TextChunk[]): string {
  if (chunks.length === 0) return "";
  const sourceEmoji: Record<string, string> = { file: "📄", webpage: "🌐", youtube: "🎬" };
  const lines = chunks.map((c, i) => {
    const emoji = sourceEmoji[c.sourceType] || "📄";
    const urlLine = c.sourceUrl ? ` (${c.sourceUrl})` : "";
    return `[${i + 1}] ${emoji} ${c.docName}${urlLine}\n${c.text}`;
  });
  return `\n\n--- Retrieved Context ---\n${lines.join("\n\n---\n")}\n--- End of Context ---\n\nWhen answering, cite sources using [1], [2], etc. If the context doesn't contain the answer, say so.`;
}

export async function getIndexedDocIds(): Promise<string[]> {
  await ensureLoaded();
  return Array.from(docIndex.keys());
}

export async function getSourceStats(): Promise<{ total: number; byType: Record<string, number>; totalChunks: number }> {
  await ensureLoaded();
  const byType: Record<string, number> = {};
  let totalChunks = 0;
  for (const entry of docIndex.values()) {
    byType[entry.info.sourceType] = (byType[entry.info.sourceType] || 0) + 1;
    totalChunks += entry.chunks.length;
  }
  return { total: docIndex.size, byType, totalChunks };
}
