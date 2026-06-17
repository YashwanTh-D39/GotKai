import { useState, useCallback, useEffect, useRef } from "react";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type StoredConversation = {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "gotkai_conversations";
const ACTIVE_KEY = "gotkai_active_id";

const EMPTY: StoredConversation[] = [];

function loadConversations(): StoredConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredConversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: StoredConversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch { /* quota exceeded */ }
}

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* noop */ }
}

export function generateTitle(text: string) {
  const words = text.replace(/[^\w\s]/g, "").trim().split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "..." : "");
}

export function useConversations() {
  const [conversations, setConversations] = useState<StoredConversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(loadActiveId);
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = true;
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(loadActiveId());
  }, []);

  useEffect(() => {
    if (hydrated.current) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (hydrated.current) saveActiveId(activeId);
  }, [activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const createConversation = useCallback((title: string) => {
    const conv: StoredConversation = {
      id: crypto.randomUUID(),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c)),
    );
  }, []);

  const updateMessages = useCallback((id: string, messagesOrUpdater: StoredMessage[] | ((prev: StoredMessage[]) => StoredMessage[])) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = typeof messagesOrUpdater === "function" ? messagesOrUpdater(c.messages) : messagesOrUpdater;
        return { ...c, messages: next, updatedAt: Date.now() };
      }),
    );
  }, []);

  const switchConversation = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  return {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    updateMessages,
    switchConversation,
    setConversations,
  };
}
