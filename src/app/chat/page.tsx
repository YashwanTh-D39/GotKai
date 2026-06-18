"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useConversations, type StoredMessage } from "@/hooks/useConversations";
import { putFile, type FileRef } from "@/lib/file-store";
import { validateFile, formatFileSize, isImageType, readFileAsArrayBuffer, readFileAsDataURL, extractFileText, normalizeFileType } from "@/lib/file-utils";
import { chunkText, indexDocument, searchRelevant, formatContext, removeDocument } from "@/lib/rag";
import { getMemoryContext, extractWithLLM, addMemoryFact } from "@/lib/memory";
import { routeUserIntent, getRouteReason, AGENTS, AGENT_LIST } from "@/lib/agents";
import type { AgentType } from "@/lib/agents";
import { detectArtifactType, canRenderLive, wrapHtmlPreview, downloadArtifact, type Artifact } from "@/lib/artifacts";
import { speakLong, stopSpeech, isSpeaking, ensureVoices, createSTTEngine, loadVoiceSettings, saveVoiceSettings, VOICE_PROFILES, getVoiceProfile } from "@/lib/voice";
import type { VoiceSettings } from "@/lib/voice";

// ── Syntax Theme ────────────────────────────────────

const codeStyle: Record<string, React.CSSProperties> = {
  'pre[class*="language-"]': { background: "#18181b", margin: 0, padding: "1rem", fontSize: "0.8125rem", lineHeight: 1.6, overflowX: "auto" },
  'code[class*="language-"]': { color: "#e4e4e7", background: "transparent", fontFamily: "inherit" },
  comment: { color: "#71717a", fontStyle: "italic" }, prolog: { color: "#71717a" }, doctype: { color: "#71717a" }, cdata: { color: "#71717a" },
  punctuation: { color: "#d4d4d8" }, namespace: { opacity: 0.7 }, property: { color: "#fde68a" }, tag: { color: "#c084fc" },
  boolean: { color: "#c084fc" }, number: { color: "#fde68a" }, constant: { color: "#c084fc" }, symbol: { color: "#86efac" },
  deleted: { color: "#fca5a5" }, selector: { color: "#86efac" }, "attr-name": { color: "#fde68a" }, string: { color: "#86efac" },
  char: { color: "#86efac" }, builtin: { color: "#f472b6" }, inserted: { color: "#86efac" }, operator: { color: "#d4d4d8" },
  entity: { color: "#e4e4e7", cursor: "help" }, url: { color: "#60a5fa" }, atrule: { color: "#c084fc" }, "attr-value": { color: "#86efac" },
  keyword: { color: "#c084fc" }, function: { color: "#60a5fa" }, "class-name": { color: "#60a5fa" }, important: { color: "#c084fc", fontWeight: "bold" },
  regex: { color: "#fde68a" }, variable: { color: "#e4e4e7" },
};

// ── Helpers ─────────────────────────────────────────

const now = () => Date.now();
const formatTime = (d: number) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatDate = (ts: number | null) => {
  if (ts === null) return "";
  const t = Date.now();
  const d = new Date(ts);
  const sameDay = d.getDate() === new Date(t).getDate() && d.getMonth() === new Date(t).getMonth() && d.getFullYear() === new Date(t).getFullYear();
  return sameDay ? formatTime(ts) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + formatTime(ts);
};
const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

// ── Code Block ──────────────────────────────────────

function CodeBlock({ className, children, onShowArtifact }: { className?: string; children?: React.ReactNode; onShowArtifact?: (lang: string, code: string) => void }) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;
  const codeString = String(children).replace(/\n$/, "");
  if (isInline) return <code className="rounded-md bg-zinc-700/60 px-1.5 py-0.5 text-sm font-mono text-pink-300">{children}</code>;
  const language = className.replace(/^language-/, "");
  const isRunnable = ["html", "htm", "svg", "jsx", "tsx", "javascript", "typescript"].includes(language);
  return (
    <div className="mb-4 mt-2 rounded-xl border border-zinc-700/50 overflow-hidden max-w-full">
      <div className="flex items-center justify-between bg-zinc-900 px-3 sm:px-4 py-1.5 border-b border-zinc-700/50">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider truncate">{language}</span>
        <div className="flex items-center gap-1">
          {onShowArtifact && (
            <button onClick={() => onShowArtifact(language, codeString)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
              title="Open in Artifact">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z" /><path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.81 12.164 9.315 12.75 12 12.75Z" /><path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 15.914 9.315 16.5 12 16.5Z" /><path d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 19.664 9.315 20.25 12 20.25Z" /></svg>
              Artifact
            </button>
          )}
          <button onClick={async () => { await copyToClipboard(codeString); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800">
            {copied ? (
              <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-green-400"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg> Copied</>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Z" clipRule="evenodd" /></svg> Copy</>
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter language={language} style={codeStyle} customStyle={{ margin: 0, borderRadius: 0, background: "#18181b" }}
        showLineNumbers={codeString.split("\n").length > 3}>{codeString}</SyntaxHighlighter>
    </div>
  );
}

// ── Markdown Components Factory ─────────────────────

function createMdComponents(onShowArtifact?: (lang: string, code: string) => void) {
  return {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl font-semibold mt-5 mb-3 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h3>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
    code: (props: { className?: string; children?: React.ReactNode }) => <CodeBlock {...props} onShowArtifact={onShowArtifact} />,
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold" style={{ color: "var(--foreground)" }}>{children}</strong>,
    blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-4 border-indigo-500 pl-4 my-4 italic" style={{ color: "var(--muted)" }}>{children}</blockquote>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} className="text-indigo-400 underline hover:text-indigo-300" target="_blank" rel="noreferrer">{children}</a>,
    hr: () => <hr className="my-6 border-zinc-700/50" />,
  };
}

// ─── Main Component ─────────────────────────────────

export default function ChatPage() {
  const {
    conversations, activeId, activeConversation, createConversation, deleteConversation,
    renameConversation, updateMessages, switchConversation,
  } = useConversations();

  const { isDark, toggleTheme } = useTheme();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge hub state
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetchOpen, setFetchOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const fetchInputRef = useRef<HTMLInputElement>(null);

  // Streaming latency optimizations
  const [streamingContent, setStreamingContent] = useState("");
  const streamingContentRef = useRef("");
  const streamingIdRef = useRef<string | null>(null);
  const lastRenderRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Agent system
  const [currentAgent, setCurrentAgent] = useState<AgentType>("reasoning");
  const [agentOverride, setAgentOverride] = useState<AgentType | null>(null);
  const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);

  // Artifact system
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);

  // Voice input
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const voiceSettingsRef = useRef(voiceSettings);
  const sttEngineRef = useRef<ReturnType<typeof createSTTEngine> | null>(null);

  // Learning / feedback
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});

  // Derive local messages from active conversation
  const storedMessages: StoredMessage[] = activeConversation?.messages ?? [];
  const messages = streamingIdRef.current && streamingContent
    ? storedMessages.map((m) =>
        m.id === streamingIdRef.current ? { ...m, content: streamingContent } : m,
      )
    : storedMessages;

  const setMessages = useCallback(
    (updater: StoredMessage[] | ((prev: StoredMessage[]) => StoredMessage[]), convId?: string) => {
      const id = convId ?? activeConversation?.id;
      if (!id) return;
      updateMessages(id, updater);
    },
    [activeConversation, updateMessages],
  );

  // Reset state when switching conversations
  const prevActiveRef = useRef(activeId);
  useEffect(() => {
    if (prevActiveRef.current !== activeId) {
      setEditingId(null);
      setEditValue("");
      setInput("");
      setIsLoading(false);
      prevActiveRef.current = activeId;
    }
  }, [activeId]);

  // Effects
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Reset scroll lock when user manually scrolls to bottom
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 100;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    userScrolledUpRef.current = !isNearBottom;
  }, []);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }, [input]);
  useEffect(() => {
    if (editingId && editRef.current) { editRef.current.focus(); editRef.current.style.height = "auto"; editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 200)}px`; }
  }, [editingId]);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);
  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); }
  }, [renamingId]);

  // Chat logic
  const handleStop = useCallback(() => { abortRef.current?.abort(); abortRef.current = null; setIsLoading(false); }, []);

  const streamChat = useCallback(async (history: { role: string; content: string }[], overrideConvId?: string, hiddenContext?: string, detectedAgent?: AgentType) => {
    const id = overrideConvId ?? activeConversation?.id;
    if (!id) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const aiId = crypto.randomUUID();
    streamingIdRef.current = aiId;
    streamingContentRef.current = "";
    lastRenderRef.current = 0;

    const tempMsg: StoredMessage = { id: aiId, role: "assistant", content: "", timestamp: now() };
    setMessages((prev) => [...prev, tempMsg], id);

    // Prepend hidden context as a system message (not visible to user)
    const fullHistory = hiddenContext
      ? [{ role: "system" as const, content: hiddenContext }, ...history]
      : history;

    const parseSSE = (chunk: string, buffer: string): { text: string; rest: string } => {
      buffer += chunk;
      const lines = buffer.split("\n");
      const rest = lines.pop() ?? "";
      let text = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) text += delta;
        } catch {}
      }
      return { text, rest };
    };

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      // Send the detected agent to the server (from regex routing, or user override)
      const finalAgent = agentOverride ?? detectedAgent ?? "reasoning";
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullHistory, agent: finalAgent }),
        signal: controller.signal,
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Request failed (${res.status})`); }

      // Read agent from server response header (server echoes it back)
      const serverAgent = res.headers.get("X-Agent") as AgentType | null;
      if (serverAgent && !agentOverride) {
        setCurrentAgent(serverAgent);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let acc = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const { text, rest } = parseSSE(chunk, sseBuffer);
        sseBuffer = rest;

        if (text) {
          const isFirstContent = !streamingContentRef.current;
          acc += text;
          streamingContentRef.current = acc;

          const now = Date.now();
          if (isFirstContent || now - lastRenderRef.current > 50) {
            lastRenderRef.current = now;
            setStreamingContent(acc);
          }
        }
      }

      streamingIdRef.current = null;
      setStreamingContent("");
      setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: acc } : m), id);

      // Auto-speak if enabled
      const vs = voiceSettingsRef.current;
      if (vs.autoTTS && acc.trim()) {
        const profile = getVoiceProfile(vs.activeVoiceId) || VOICE_PROFILES[0];
        ensureVoices().then(() => { speakLong(acc, profile, { pitch: vs.pitch, rate: vs.rate }); });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const partial = streamingContentRef.current;
        if (partial) {
          setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: partial } : m), id);
        }
        return;
      }
      setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: m.content || (err instanceof Error ? err.message : "Something went wrong") } : m), id);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      streamingIdRef.current = null;
      streamingContentRef.current = "";
      setStreamingContent("");
    }
  }, [activeConversation, setMessages]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && pendingFiles.length === 0) || isLoading) return;
    setInput("");

    // Create conversation if none active
    let convId = activeConversation?.id;
    if (!convId) {
      const conv = createConversation("");
      convId = conv.id;
      renameConversation(conv.id, (content || pendingFiles[0]?.name || "File upload").split(" ").slice(0, 6).join(" ").substring(0, 50));
    }

    // Generate title from first user message
    if (activeConversation?.messages.length === 0) {
      const titleSource = content || pendingFiles[0]?.name || "File upload";
      const title = titleSource.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 6).join(" ") + (titleSource.trim().split(/\s+/).length > 6 ? "..." : "");
      renameConversation(convId, title);
    }

    // Store pending files in IndexedDB + build file refs + index for RAG
    const fileRefs: FileRef[] = [];
    for (const f of pendingFiles) {
      try {
        const id = crypto.randomUUID();
        const type = normalizeFileType(f);
        const buffer = await readFileAsArrayBuffer(f);
        await putFile({
          id, name: f.name, size: f.size, type,
          data: buffer, conversationId: convId, createdAt: Date.now(),
        });
        fileRefs.push({ id, name: f.name, size: f.size, type });

          if (!isImageType(type)) {
            const extracted = await extractFileText(type, buffer);
            if (extracted.trim()) {
              const chunks = chunkText(extracted, id, f.name, "file");
              await indexDocument(chunks, { sourceType: "file" });
            }
          }
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Unknown error";
        console.warn("File processing error:", reason);
      }
    }
    setPendingFiles([]);
    setImagePreviews({});

    // Retrieve relevant RAG context for the user's query
    const ragContext = await searchRelevant(content);
    const ragContextBlock = formatContext(ragContext);

    // Retrieve persistent memory
    const memoryBlock = getMemoryContext();

    // Build hidden context block (sent to AI, not visible to user)
    const hiddenContext = [ragContextBlock, memoryBlock].filter(Boolean).join("\n") || undefined;

    // User message: only their text + file names (no raw document dumps)
    const fileSummary = fileRefs.length > 0
      ? `\n\n[Attached files: ${fileRefs.map((r) => r.name).join(", ")}]`
      : "";
    const visibleContent = `${content}${fileSummary}`;

    const userMsg: StoredMessage = {
      id: crypto.randomUUID(), role: "user", content: visibleContent,
      files: fileRefs.length > 0 ? fileRefs : undefined,
      timestamp: now(),
    };
    const currentMsgs = activeConversation?.messages ?? [];
    const updated = [...currentMsgs, userMsg];
    updateMessages(convId, updated);

    // Extract memory from conversation (fire-and-forget, don't block chat)
    extractWithLLM(updated.map(({ role, content }) => ({ role, content }))).catch(() => {});

    // Auto-detect agent from user message
    const detectedAgent = agentOverride ?? routeUserIntent(content);
    setCurrentAgent(detectedAgent);

    streamChat(updated.map(({ role, content }) => ({ role, content })), convId, hiddenContext, detectedAgent);
  }, [input, isLoading, activeConversation, createConversation, renameConversation, updateMessages, streamChat, pendingFiles]);

  const handleRegenerate = useCallback(async () => {
    const idx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (idx < 0) return;
    const msgs = messages.slice(0, idx);
    setMessages(msgs);
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const ragContext = await searchRelevant(lastUser?.content || "");
    const ragBlock = formatContext(ragContext);
    const memoryBlock = getMemoryContext();
    const hidden = [ragBlock, memoryBlock].filter(Boolean).join("\n") || undefined;
    const detectedAgent = agentOverride ?? routeUserIntent(lastUser?.content || "");
    streamChat(msgs.map(({ role, content }) => ({ role, content })), undefined, hidden, detectedAgent);
  }, [messages, setMessages, streamChat, agentOverride]);

  const handleEditStart = (msg: StoredMessage) => { if (msg.role !== "user") return; setEditingId(msg.id); setEditValue(msg.content); };
  const handleEditSave = async () => {
    if (!editingId || !editValue.trim()) return;
    const idx = messages.findIndex((m) => m.id === editingId);
    if (idx === -1) return;
    const edited = { ...messages[idx], content: editValue.trim(), timestamp: now() };
    const updated = [...messages.slice(0, idx), edited];
    setMessages(updated); setEditingId(null); setEditValue("");
    const ragContext = await searchRelevant(editValue.trim());
    const ragBlock = formatContext(ragContext);
    const memoryBlock = getMemoryContext();
    const hidden = [ragBlock, memoryBlock].filter(Boolean).join("\n") || undefined;
    const detectedAgent = agentOverride ?? routeUserIntent(editValue.trim());
    streamChat(updated.map(({ role, content }) => ({ role, content })), undefined, hidden, detectedAgent);
  };
  const handleEditCancel = () => { setEditingId(null); setEditValue(""); };

  const handleNewChat = () => {
    handleStop();
    switchConversation(null);
    setInput("");
    setEditingId(null);
    setSidebarOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── File Upload Handlers ──────────────────────────

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: File[] = [];
    const errs: string[] = [];
    for (const f of arr) {
      const err = validateFile(f);
      if (err) { errs.push(`${f.name}: ${err}`); continue; }
      try { normalizeFileType(f); } catch { errs.push(`${f.name}: Unable to determine file type`); continue; }
      valid.push(f);
    }
    if (errs.length > 0) setFileErrors(errs);
    if (valid.length === 0) return;
    setPendingFiles((prev) => [...prev, ...valid]);
    const previews: Record<string, string> = {};
    for (const f of valid) {
      if (isImageType(f.type)) {
        previews[`${f.name}_${f.size}`] = await readFileAsDataURL(f);
      }
    }
    setImagePreviews((prev) => ({ ...prev, ...previews }));
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const f = prev[index];
      if (f && isImageType(f.type)) {
        setImagePreviews((p) => { const n = { ...p }; delete n[`${f.name}_${f.size}`]; return n; });
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files); }, [processFiles]);

  const handleAttachClick = useCallback(() => { fileInputRef.current?.click(); }, []);

  // ── Knowledge Hub: URL Fetch ─────────────────────

  const handleFetchUrl = useCallback(async () => {
    const url = fetchUrl.trim();
    if (!url || fetching) return;
    setFetching(true);
    try {
      const type = url.includes("youtube.com") || url.includes("youtu.be") ? "youtube" : "webpage";
      const res = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFileErrors([err.error || `Failed to fetch ${url}`]);
        return;
      }
      const data = await res.json();
      if (data.content && data.content.length > 100) {
        const id = crypto.randomUUID();
        const chunks = chunkText(data.content, id, data.title || url, data.sourceType || type, url);
        await indexDocument(chunks, { sourceType: data.sourceType || type, sourceUrl: url });
        setFileErrors([`✅ Indexed: "${(data.title || url).substring(0, 60)}" (${chunks.length} chunks)`]);
        setFetchUrl("");
        setFetchOpen(false);
      } else {
        setFileErrors([`⚠️ "${(data.title || url).substring(0, 60)}" returned insufficient content.`]);
      }
    } catch (err) {
      setFileErrors([`Failed to fetch: ${err instanceof Error ? err.message : "Unknown error"}`]);
    } finally {
      setFetching(false);
    }
  }, [fetchUrl, fetching]);

  // Auto-focus URL input when opened
  useEffect(() => {
    if (fetchOpen && fetchInputRef.current) {
      fetchInputRef.current.focus();
    }
  }, [fetchOpen]);

  const clearFileErrors = useCallback(() => setFileErrors([]), []);

  // ── Voice Input ─────────────────────────────────

  const startRecording = useCallback(() => {
    if (!voiceSettings.voiceInputEnabled) return;
    const engine = createSTTEngine("en-US");
    if (!engine.isSupported()) { setFileErrors(["Voice input is not supported in this browser."]); return; }
    sttEngineRef.current = engine;
    setIsRecording(true);
    engine.start((text, isFinal) => {
      setInput((prev) => isFinal ? prev + text + " " : prev + text);
    });
  }, [voiceSettings.voiceInputEnabled, setFileErrors]);

  const stopRecording = useCallback(() => {
    sttEngineRef.current?.stop();
    sttEngineRef.current = null;
    setIsRecording(false);
  }, []);

  // ── Learning / Feedback ──────────────────────────

  const handleFeedback = useCallback((msgId: string, type: "up" | "down") => {
    setFeedbackMap((prev) => ({ ...prev, [msgId]: type }));
    // Find the corresponding user message for context
    const msgIndex = storedMessages.findIndex((m) => m.id === msgId);
    const userMsg = msgIndex > 0 ? storedMessages[msgIndex - 1] : null;
    const feedbackEntry = { messageId: msgId, type, userMessage: userMsg?.content?.substring(0, 200), timestamp: Date.now() };

    // Persist to localStorage
    try {
      const key = "gotkai_feedback";
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : {};
      data[msgId] = feedbackEntry;
      localStorage.setItem(key, JSON.stringify(data));

      // Downvotes -> add learning signal to memory
      if (type === "down" && userMsg?.content) {
        addMemoryFact(
          `User disagreed with my response about "${userMsg.content.substring(0, 100)}". I should verify information more carefully on this topic.`,
          "correction",
          "feedback",
        );
      }
    } catch {}
  }, [storedMessages]);

  // ── Text-to-Speech ──────────────────────────────

  const handleTTS = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking()) stopSpeech();
    const profile = getVoiceProfile(voiceSettings.activeVoiceId) || VOICE_PROFILES[0];
    ensureVoices().then(() => {
      speakLong(text, profile, { pitch: voiceSettings.pitch, rate: voiceSettings.rate });
    });
  }, [voiceSettings]);

  // ── Artifact Handlers ─────────────────────────────

  const addArtifact = useCallback((language: string, content: string) => {
    const type = detectArtifactType(language, content);
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      type,
      title: `Code (${language})`,
      content,
      language,
      createdAt: Date.now(),
    };
    setArtifacts((prev) => [artifact, ...prev]);
    setActiveArtifact(artifact);
    setArtifactPanelOpen(true);
  }, []);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Render ──────────────────────────────────────
  return (
    <div suppressHydrationWarning className={`flex h-screen overflow-hidden ${isDark ? "bg-[#212121]" : "bg-white"}`}
      style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>
      {/* Overlay */}
      <AnimatePresenceWrapper show={sidebarOpen}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
      </AnimatePresenceWrapper>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className={`flex-shrink-0 w-72 flex flex-col z-50 transition-transform duration-300
        ${isDark ? "bg-[#171717] border-r border-zinc-800/60" : "bg-zinc-50 border-r border-zinc-200/80"}
        ${sidebarOpen ? "fixed inset-y-0 left-0 shadow-2xl z-50" : "hidden"} lg:relative lg:flex`}>
        <div className={`flex items-center justify-between px-4 h-14 shrink-0 ${isDark ? "border-b border-zinc-800/60" : "border-b border-zinc-200/80"}`}>
          <a href="/" className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">GotKai</a>
          <button onClick={() => setSidebarOpen(false)}
            className={`lg:hidden size-8 flex items-center justify-center rounded-lg ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* New Chat */}
        <div className="p-3">
          <button onClick={handleNewChat} className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all
            ${isDark ? "border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white" : "border-zinc-200/80 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H5.25a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700/50 bg-zinc-800/30" : "border-zinc-200/80 bg-white"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0 text-zinc-500"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" /></svg>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations..."
              className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-zinc-300 placeholder-zinc-500" : "text-zinc-700 placeholder-zinc-400"}`} />
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {filteredConversations.map((conv) => (
            <div key={conv.id} className="group relative">
              {renamingId === conv.id ? (
                <input ref={renameRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { renameConversation(conv.id, renameValue.trim() || conv.title); setRenamingId(null); } if (e.key === "Escape") setRenamingId(null); }}
                  onBlur={() => { renameConversation(conv.id, renameValue.trim() || conv.title); setRenamingId(null); }}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? "bg-zinc-800 text-zinc-200" : "bg-white text-zinc-700 border border-zinc-300"}`} />
              ) : (
                <div onClick={() => { switchConversation(conv.id); setSidebarOpen(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchConversation(conv.id); setSidebarOpen(false); } }}
                  role="button" tabIndex={0}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition-all cursor-pointer
                    ${activeId === conv.id
                      ? isDark ? "bg-zinc-800/60 text-zinc-200" : "bg-zinc-200/60 text-zinc-800"
                      : isDark ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0 text-zinc-600">
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.782a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                  </svg>
                  <span className="truncate flex-1 text-left">{conv.title || "Untitled"}</span>
                  {/* Actions */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 sm:flex">
                    <button onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className="size-7 sm:size-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors active:scale-90" title="Rename">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 sm:size-3"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="size-7 sm:size-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/20 transition-colors active:scale-90" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 sm:size-3"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`border-t ${isDark ? "border-zinc-800/60" : "border-zinc-200/80"}`}>
          <div className="p-3 space-y-1">
            <button onClick={toggleTheme}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${isDark ? "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"}`}>
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" /></svg>
              )}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <a href="/settings"
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${isDark ? "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567l-.09.564a8.526 8.526 0 0 0-1.184.688l-.539-.366a1.734 1.734 0 0 0-2.078-.052l-1.36 1.02a1.734 1.734 0 0 0-.374 2.094l.408.727c.207.37.377.763.506 1.174l-.017.5a8.59 8.59 0 0 0 .018 1.286l-.508.728a1.734 1.734 0 0 0 .374 2.094l1.36 1.02c.636.477 1.502.33 2.078-.052l.539-.366c.376.263.77.497 1.184.688l.09.563a1.85 1.85 0 0 0 1.85 1.568h1.595c.917 0 1.699-.663 1.85-1.567l.09-.564c.414-.19.808-.425 1.184-.688l.539.366a1.734 1.734 0 0 0 2.078.052l1.36-1.02a1.734 1.734 0 0 0 .374-2.094l-.408-.727a8.52 8.52 0 0 1-.506-1.174l.017-.5a8.59 8.59 0 0 0-.018-1.286l.508-.728a1.734 1.734 0 0 0-.374-2.094l-1.36-1.02c-.636-.477-1.502-.33-2.078.052l-.539.366a8.526 8.526 0 0 0-1.184-.688l-.09-.563a1.85 1.85 0 0 0-1.85-1.568h-1.596ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" clipRule="evenodd" /></svg>
              <span>Settings</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ── Artifact Panel ──────────────────────── */}
      <AnimatePresence>
        {artifactPanelOpen && activeArtifact && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 480, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`flex-shrink-0 overflow-hidden border-l z-30 ${isDark ? "bg-[#1a1a1a] border-zinc-800/60" : "bg-white border-zinc-200/80"}`}>
            <div className="flex flex-col h-full w-[480px]">
              {/* Artifact header */}
              <div className={`flex items-center justify-between px-4 h-12 shrink-0 border-b ${isDark ? "border-zinc-800/60" : "border-zinc-200/80"}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 text-indigo-400 shrink-0"><path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z" /><path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.81 12.164 9.315 12.75 12 12.75Z" /><path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 15.914 9.315 16.5 12 16.5Z" /><path d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 19.664 9.315 20.25 12 20.25Z" /></svg>
                  <span className={`text-sm font-medium truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {activeArtifact.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => downloadArtifact(activeArtifact)}
                    className={`size-7 flex items-center justify-center rounded-md ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}
                    title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M12 1.5a.75.75 0 0 1 .75.75V7.5h-1.5V2.25A.75.75 0 0 1 12 1.5ZM11.25 7.5v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V7.5h1.5v4.19l1.22-1.22a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.22 1.22V7.5h1.5Z" /><path d="M3 11.25a.75.75 0 0 1 .75.75v6A2.25 2.25 0 0 0 6 20.25h12A2.25 2.25 0 0 0 20.25 18v-6a.75.75 0 0 1 1.5 0v6A3.75 3.75 0 0 1 18 21.75H6A3.75 3.75 0 0 1 2.25 18v-6a.75.75 0 0 1 .75-.75Z" /></svg>
                  </button>
                  <button onClick={() => setArtifactPanelOpen(false)}
                    className={`size-7 flex items-center justify-center rounded-md ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
              {/* Artifact content */}
              <div className="flex-1 overflow-y-auto">
                {canRenderLive(activeArtifact) ? (
                  <iframe
                    srcDoc={activeArtifact.type === "html" ? wrapHtmlPreview(activeArtifact.content) : activeArtifact.content}
                    className="w-full h-full border-0"
                    title={activeArtifact.title}
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <SyntaxHighlighter language={activeArtifact.language} style={codeStyle}
                    customStyle={{ margin: 0, borderRadius: 0, background: "#18181b", minHeight: "100%", padding: "1rem" }}
                    showLineNumbers>{activeArtifact.content}</SyntaxHighlighter>
                )}
              </div>
              {/* Artifact history */}
              {artifacts.length > 1 && (
                <div className={`border-t shrink-0 ${isDark ? "border-zinc-800/60" : "border-zinc-200/80"}`}>
                  <div className="px-3 py-2">
                    <div className={`text-[11px] font-medium mb-1.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Recent Artifacts</div>
                    <div className="flex gap-1.5 overflow-x-auto">
                      {artifacts.slice(0, 10).map((a) => (
                        <button key={a.id} onClick={() => setActiveArtifact(a)}
                          className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all
                            ${activeArtifact.id === a.id
                              ? isDark ? "bg-zinc-700 text-zinc-200" : "bg-zinc-200 text-zinc-800"
                              : isDark ? "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"}`}>
                          <span>{a.type === "html" ? "🌐" : a.type === "svg" ? "🎨" : "📄"}</span>
                          <span className="max-w-[80px] truncate">{a.language}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Area ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative"
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {/* Drop Zone Overlay */}
        <AnimatePresenceWrapper show={dragOver}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-indigo-500/60 bg-indigo-500/10 backdrop-blur-sm"
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className="flex flex-col items-center gap-3 px-8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-10 text-indigo-400">
                <path fillRule="evenodd" d="M10.5 3.75a6 6 0 0 0-5.98 6.496A5.25 5.25 0 0 0 6.75 20.5H18a4.5 4.5 0 0 0 2.206-8.423 3.75 3.75 0 0 0-4.133-4.303A6.001 6.001 0 0 0 10.5 3.75Zm2.03 5.47a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72v4.94a.75.75 0 0 0 1.5 0v-4.94l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z" clipRule="evenodd" />
              </svg>
              <p className="text-base font-medium text-indigo-300">Drop files here</p>
              <p className="text-sm text-zinc-500">PDF, DOCX, TXT, JPG, PNG, WEBP &middot; Max 20MB</p>
            </div>
          </motion.div>
        </AnimatePresenceWrapper>

        {/* File error toasts */}
        <AnimatePresence>
          {fileErrors.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute top-2 right-2 z-50 flex flex-col gap-1 max-w-sm">
              {fileErrors.map((err, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs shadow-lg ${isDark ? "bg-red-900/80 text-red-200 border border-red-700/50" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0 mt-0.5 text-red-400"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" /></svg>
                  <span className="flex-1">{err}</span>
                  <button onClick={clearFileErrors} className="text-red-300 hover:text-red-100">&times;</button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Artifact Button */}
        {artifacts.length > 0 && !artifactPanelOpen && (
          <button onClick={() => { setActiveArtifact(artifacts[0]); setArtifactPanelOpen(true); }}
            className={`absolute bottom-20 right-4 z-30 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-lg transition-all hover:scale-105
              ${isDark ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z" /><path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.81 12.164 9.315 12.75 12 12.75Z" /><path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 15.914 9.315 16.5 12 16.5Z" /><path d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.81 19.664 9.315 20.25 12 20.25Z" /></svg>
            {artifacts.length} Artifact{artifacts.length > 1 ? "s" : ""}
          </button>
        )}

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.js,.ts,.jsx,.tsx,.css,.html,.md,.csv,.json,.xml,.py,.java,.c,.cpp,.rs,.go,.rb,.php,.sh,.yaml,.yml,.jpg,.jpeg,.png,.webp"
          onChange={(e) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; } }}
          className="hidden" />

        {/* Header */}
        <header className={`flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14 shrink-0 border-b ${isDark ? "border-zinc-800/60 bg-[#212121]/80 backdrop-blur-xl" : "border-zinc-200/80 bg-white/80 backdrop-blur-xl"}`}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)}
              className={`size-7 sm:size-8 flex items-center justify-center rounded-lg ${isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
            </button>
            <span className={`text-sm font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {activeConversation?.title ? activeConversation.title.substring(0, 30) : "New Chat"}
            </span>
            {/* Agent Badge */}
            <div className="relative">
              <button onClick={() => setAgentSelectorOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all
                  ${isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"}`}>
                <span>{AGENTS[currentAgent].emoji}</span>
                <span>{AGENTS[currentAgent].label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3"><path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" /></svg>
              </button>
              <AnimatePresence>
                {agentSelectorOpen && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={`absolute top-full right-0 mt-1 w-48 rounded-xl border shadow-xl z-50 overflow-hidden
                      ${isDark ? "bg-[#27272a] border-zinc-700/50" : "bg-white border-zinc-200/80"}`}>
                    {AGENT_LIST.map((a) => (
                      <button key={a.id} onClick={() => { setCurrentAgent(a.id); setAgentOverride(a.id); setAgentSelectorOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left transition-all
                          ${currentAgent === a.id
                            ? isDark ? "bg-zinc-700/60 text-zinc-200" : "bg-zinc-100 text-zinc-800"
                            : isDark ? "text-zinc-400 hover:bg-zinc-700/40 hover:text-zinc-200" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"}`}>
                        <span className="text-base">{a.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{a.label}</div>
                          <div className={`text-[10px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{a.description}</div>
                        </div>
                        {currentAgent === a.id && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 text-indigo-400"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    ))}
                    {agentOverride && (
                      <div className={`border-t px-3 py-2 ${isDark ? "border-zinc-700/50" : "border-zinc-200/80"}`}>
                        <button onClick={() => { setAgentOverride(null); setAgentSelectorOpen(false); }}
                          className={`text-[11px] ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}>
                          ↻ Auto-detect
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {isLoading && (
            <button onClick={handleStop} className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" /></svg> Stop
            </button>
          )}
        </header>

        {/* Messages */}
        <div ref={messagesContainerRef} onScroll={handleMessagesScroll}
          className={`flex-1 overflow-y-auto ${isDark ? "bg-[#212121]" : "bg-zinc-50/50"}`}>
          <div className="mx-auto max-w-[850px] px-2 sm:px-4 py-4 sm:py-6 md:px-6 lg:px-8">
            {!activeConversation ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                <EmptyState />
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                    {editingId === msg.id ? (
                      <EditBubble value={editValue} onChange={setEditValue} onSave={handleEditSave} onCancel={handleEditCancel} isDark={isDark} />
                    ) : (
                      <ChatBubble message={msg} isDark={isDark} hydrated={hydrated}
                        isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant" && msg.content === ""}
                        onEdit={() => handleEditStart(msg)}
                        onRegenerate={msg.role === "assistant" && i === messages.length - 1 && !isLoading ? handleRegenerate : undefined}
                        onFeedback={msg.role === "assistant" ? handleFeedback : undefined}
                        onTTS={msg.role === "assistant" ? handleTTS : undefined}
                        agent={msg.role === "assistant" ? AGENTS[currentAgent] : undefined}
                        onShowArtifact={addArtifact} />
                    )}
                  </motion.div>
                ))}

                {isLoading && !messages[messages.length - 1]?.content && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <SkeletonBubble isDark={isDark} />
                  </motion.div>
                )}

                {isLoading && messages[messages.length - 1]?.role === "assistant" && !!messages[messages.length - 1]?.content && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-4 py-4">
                    <div className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        {/* Input */}
        <div className={`border-t shrink-0 ${isDark ? "border-zinc-800/60" : "border-zinc-200/80"}`}>
          <div className={`px-3 sm:px-4 py-3 sm:py-4 ${isDark ? "bg-[#212121]" : "bg-white"}`}>
            <div className="mx-auto max-w-[850px]">
              <div className={`rounded-2xl border transition-all ${isDark ? "border-zinc-700/50 bg-[#2a2a2a] focus-within:border-zinc-500" : "border-zinc-200/80 bg-zinc-50 focus-within:border-zinc-300"}`}>
                <div className="flex items-end gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
                  <div className="relative">
                    <button onClick={() => { setFetchOpen((v) => !v); setFetchUrl(""); }}
                      className={`shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"}`} title="Fetch URL">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" /></svg>
                    </button>
                    <AnimatePresence>
                      {fetchOpen && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className={`absolute bottom-full left-0 mb-2 w-80 rounded-xl border shadow-xl z-50 overflow-hidden ${isDark ? "bg-[#27272a] border-zinc-700/50" : "bg-white border-zinc-200/80"}`}>
                          <div className="p-3">
                            <p className={`text-xs font-medium mb-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Add knowledge source</p>
                            <input ref={fetchInputRef} value={fetchUrl} onChange={(e) => setFetchUrl(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchUrl(); } }}
                              placeholder="Paste a URL (web page or YouTube)..."
                              className={`w-full rounded-lg px-3 py-2 text-sm outline-none border ${isDark ? "bg-zinc-800 text-zinc-200 border-zinc-700 placeholder-zinc-500" : "bg-zinc-50 text-zinc-800 border-zinc-300 placeholder-zinc-400"}`} />
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <button onClick={() => setFetchOpen(false)}
                                className={`text-xs px-2 py-1 rounded ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}>Cancel</button>
                              <button onClick={handleFetchUrl} disabled={!fetchUrl.trim() || fetching}
                                className="text-xs px-3 py-1 rounded font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
                                {fetching ? "Fetching..." : "Fetch & Index"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={handleAttachClick} className={`shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"}`} title="Attach file">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 16.835a2.25 2.25 0 0 1-3.182-3.182l8.485-8.486a.75.75 0 0 1 1.06 1.06L8.977 14.815a.75.75 0 0 0 1.06 1.06l8.934-8.934a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" /></svg>
                  </button>
                  <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={activeConversation ? "Send a message..." : "Start a new chat..."} rows={1} style={{ minHeight: 24, maxHeight: 160 }}
                    className={`flex-1 resize-none bg-transparent px-1 py-0.5 text-sm outline-none ${isDark ? "text-white placeholder-zinc-500" : "text-zinc-900 placeholder-zinc-400"}`} />
                  <button onClick={isRecording ? stopRecording : startRecording}
                    className={`shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors ${isRecording ? "text-red-400 bg-red-500/10 animate-pulse" : isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"}`} title={isRecording ? "Stop recording" : "Voice input"}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-8.25a.75.75 0 0 1 0-1.5h3.75v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
                  </button>
                  <motion.button onClick={() => handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
                    whileHover={(input.trim() || pendingFiles.length > 0) && !isLoading ? { scale: 1.05 } : {}}
                    whileTap={(input.trim() || pendingFiles.length > 0) && !isLoading ? { scale: 0.95 } : {}}
                    className={`flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/40 disabled:opacity-30 disabled:cursor-not-allowed`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                  </motion.button>
                </div>
                {/* File chips */}
                {pendingFiles.length > 0 && (
                  <div className={`flex flex-wrap gap-2 px-3 sm:px-4 pb-2.5 sm:pb-3 ${isDark ? "border-t border-zinc-700/50" : "border-t border-zinc-200/80"}`}
                    style={{ paddingTop: "0.5rem" }}>
                    {pendingFiles.map((f, i) => {
                      const preview = imagePreviews[`${f.name}_${f.size}`];
                      return (
                        <div key={`${f.name}_${f.size}_${i}`}
                          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition-all group/chip ${isDark ? "bg-zinc-800/80 border border-zinc-700/50" : "bg-white border border-zinc-200/80 shadow-sm"}`}>
                          {preview ? (
                            <img src={preview} alt="" className="size-6 rounded object-cover shrink-0" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 shrink-0 text-zinc-500">
                              <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                              <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375h1.875a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                            </svg>
                          )}
                          <span className={`max-w-[120px] sm:max-w-[160px] truncate ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{f.name}</span>
                          <span className="text-zinc-500 shrink-0">{formatFileSize(f.size)}</span>
                          <button onClick={() => removePendingFile(i)}
                            className={`size-4 flex items-center justify-center rounded-full transition-colors ${isDark ? "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className={`mt-2 text-center text-[10px] sm:text-[11px] leading-tight ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>GotKai can make mistakes. Verify important information.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 px-4 text-center">
      <div className="size-12 sm:size-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-lg sm:text-xl font-bold text-white shadow-lg shadow-blue-600/20">
        G
      </div>
      <h2 className="text-base sm:text-lg font-semibold text-zinc-300">GotKai</h2>
      <p className="text-xs sm:text-sm text-zinc-500">Start a conversation by sending a message below.</p>
    </div>
  );
}

const ChatBubble = memo(function ChatBubble({ message, isDark, hydrated, isStreaming, onEdit, onRegenerate, onFeedback, onTTS, agent, onShowArtifact }: {
  message: StoredMessage; isDark: boolean; hydrated: boolean; isStreaming: boolean; onEdit?: () => void; onRegenerate?: () => void;
  onFeedback?: (id: string, type: "up" | "down") => void; onTTS?: (text: string) => void; agent?: { emoji: string; label: string };
  onShowArtifact?: (lang: string, code: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-4 group ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 mt-0.5 size-6 sm:size-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${isUser ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-blue-500/20"}`}>
        {isUser ? "U" : "G"}
      </div>
      <div className={`flex flex-col min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed md:text-base max-w-[95%] sm:max-w-[90%] md:max-w-[85%] ${isUser ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-md" : isDark ? "bg-[#2f2f2f] border border-zinc-700/30" : "bg-white border border-zinc-200/80 shadow-sm rounded-tl-md"}`}>
          {isUser ? (
            <>
              {message.files && message.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.files.map((f) => (
                    <FileAttachment key={f.id} file={f} isDark={isDark} isUser={isUser} />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </>
          ) : isStreaming && !message.content ? (
            <span className="inline-flex gap-1 py-1">
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={createMdComponents(onShowArtifact)}>{message.content}</ReactMarkdown>
          )}
        </div>
        <div className={`flex items-center gap-1 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap ${isUser ? "flex-row-reverse" : ""}`}>
          {hydrated && message.timestamp && (
            <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{formatDate(message.timestamp)}</span>
          )}
          {/* Agent badge for assistant messages */}
          {!isUser && agent && (
            <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-100 text-zinc-500"}`}
              title={agent.label}>
              {agent.emoji}
            </span>
          )}
          {/* Feedback thumbs for assistant */}
          {!isUser && onFeedback && (
            <>
              <button onClick={() => onFeedback(message.id, "up")}
                className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
                title="Good response">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path d="M7.493 18.5c-.425 0-.82-.236-.975-.632A7.5 7.5 0 0 1 6 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75A.75.75 0 0 1 15 2a2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23h-.777Z" clipRule="evenodd" /></svg>
              </button>
              <button onClick={() => onFeedback(message.id, "down")}
                className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
                title="Bad response">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path d="M7.493 5.5c-.425 0-.82.236-.975.632A7.5 7.5 0 0 0 6 8.875c0 1.75.599 3.358 1.602 4.634.151.192.373.309.6.397.473.183.89.514 1.212.924a9.042 9.042 0 0 0 2.861 2.4c.723.384 1.35.956 1.653 1.715a4.498 4.498 0 0 1 .322 1.672v.633A.75.75 0 0 0 15 22a2.25 2.25 0 0 0 2.25-2.25c0-1.152-.26-2.243-.723-3.218-.266-.558.107-1.282.725-1.282h3.126c1.026 0 1.945-.694 2.054-1.715.045-.422.068-.85.068-1.285a11.95 11.95 0 0 0-2.649-7.521c-.388-.482-.987-.729-1.605-.729H14.23c-.483 0-.964.078-1.423.23l-3.114 1.04a4.501 4.501 0 0 1-1.423.23h-.777Z" clipRule="evenodd" /></svg>
              </button>
            </>
          )}
          {/* TTS for assistant */}
          {!isUser && onTTS && (
            <button onClick={() => onTTS(message.content)}
              className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all active:scale-90"
              title="Read aloud">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path d="M11.553 3.064A.75.75 0 0 1 12 3.75v16.5a.75.75 0 0 1-1.255.555L5.46 16H2.75A.75.75 0 0 1 2 15.25v-6.5A.75.75 0 0 1 2.75 8H5.46l5.285-4.805a.75.75 0 0 1 .808-.131ZM16.47 8.47a.75.75 0 0 1 1.06 0A5.25 5.25 0 0 1 18.75 12a5.25 5.25 0 0 1-1.22 3.53.75.75 0 0 1-1.06-1.06A3.75 3.75 0 0 0 17.25 12a3.75 3.75 0 0 0-1.22-2.47.75.75 0 0 1 0-1.06Zm3.47-2.94a.75.75 0 0 1 1.06 0A8.25 8.25 0 0 1 22.5 12a8.25 8.25 0 0 1-2.47 4.47.75.75 0 1 1-1.06-1.06A6.75 6.75 0 0 0 21 12a6.75 6.75 0 0 0-2.03-3.41.75.75 0 0 1 0-1.06Z" /></svg>
            </button>
          )}
          <CopyMessageButton text={message.content} />
          {isUser && onEdit && (
            <button onClick={onEdit} className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all active:scale-90" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
            </button>
          )}
          {!isUser && onRegenerate && (
            <button onClick={onRegenerate} className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all active:scale-90" title="Regenerate">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex size-7 sm:size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all active:scale-90" title="Copy message">
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5 text-green-400"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 sm:size-3.5"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Z" clipRule="evenodd" /></svg>
      )}
    </button>
  );
}

function EditBubble({ value, onChange, onSave, onCancel, isDark }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; isDark: boolean;
}) {
  return (
    <div className="flex gap-4 px-4 py-4 flex-row-reverse">
      <div className="shrink-0 mt-0.5 size-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">U</div>
      <div className="max-w-[95%] sm:max-w-[90%] md:max-w-[85%]">
        <div className="rounded-2xl overflow-hidden border border-indigo-500/50 shadow-lg shadow-indigo-500/10">
          <textarea value={value} onChange={(e) => onChange(e.target.value)}
            className={`w-full resize-none px-4 py-3 text-sm outline-none ${isDark ? "bg-[#2f2f2f] text-white" : "bg-white text-zinc-900"}`}
            style={{ minHeight: 80, maxHeight: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); } if (e.key === "Escape") onCancel(); }} />
          <div className={`flex items-center justify-end gap-2 px-3 py-2 border-t ${isDark ? "bg-[#2f2f2f] border-zinc-700" : "bg-zinc-50 border-zinc-200"}`}>
            <button onClick={onCancel} className={`px-3 py-1 rounded-lg text-xs ${isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200"}`}>Cancel</button>
            <button onClick={onSave} disabled={!value.trim()} className="px-4 py-1 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-40">Save & Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonBubble({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-4 animate-pulse">
      <div className={`shrink-0 mt-0.5 size-6 sm:size-8 rounded-full ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
      <div className="flex flex-col gap-2 flex-1 max-w-[95%] sm:max-w-[85%]">
        <div className={`h-4 w-3/4 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
        <div className={`h-4 w-1/2 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
        <div className={`h-4 w-2/3 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
      </div>
    </div>
  );
}

// ── File Attachment Display ─────────────────────────

function FileAttachment({ file, isDark, isUser }: { file: FileRef; isDark: boolean; isUser: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isImageType(file.type)) return;
    getFilePreview(file.id).then(setPreview);
  }, [file.id, file.type]);

  if (isImageType(file.type) && preview) {
    return (
      <>
        <button onClick={() => setExpanded(!expanded)}
          className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 ${isUser ? "border-white/20" : "border-zinc-700/30"}`}>
          <img src={preview} alt={file.name} className="size-16 sm:size-20 object-cover" />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 cursor-pointer">
              <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                src={preview} alt={file.name} className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${isUser ? "bg-white/10" : isDark ? "bg-zinc-800/60" : "bg-zinc-100"}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 shrink-0 text-zinc-500">
        <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375h1.875a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
      </svg>
      <span className={`max-w-[140px] truncate ${isUser ? "text-white/90" : isDark ? "text-zinc-300" : "text-zinc-700"}`}>{file.name}</span>
      <span className={isUser ? "text-white/60" : "text-zinc-500"}>{formatFileSize(file.size)}</span>
    </div>
  );
}

async function getFilePreview(fileId: string): Promise<string | null> {
  try {
    const { getFile } = await import("@/lib/file-store");
    const stored = await getFile(fileId);
    if (!stored) return null;
    const blob = new Blob([stored.data], { type: stored.type });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ── AnimatePresence wrapper ─────────────────────────

function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <AnimatePresence>{children}</AnimatePresence>;
}
