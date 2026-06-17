"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useConversations, type StoredMessage } from "@/hooks/useConversations";

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

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;
  const codeString = String(children).replace(/\n$/, "");
  if (isInline) return <code className="rounded-md bg-zinc-700/60 px-1.5 py-0.5 text-sm font-mono text-pink-300">{children}</code>;
  const language = className.replace(/^language-/, "");
  return (
    <div className="mb-4 mt-2 rounded-xl border border-zinc-700/50 overflow-hidden">
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-1.5 border-b border-zinc-700/50">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{language}</span>
        <button onClick={async () => { await copyToClipboard(codeString); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          {copied ? (
            <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-green-400"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg> Copied</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Z" clipRule="evenodd" /></svg> Copy</>
          )}
        </button>
      </div>
      <SyntaxHighlighter language={language} style={codeStyle} customStyle={{ margin: 0, borderRadius: 0, background: "#18181b" }}
        showLineNumbers={codeString.split("\n").length > 3}>{codeString}</SyntaxHighlighter>
    </div>
  );
}

// ── Markdown Components ─────────────────────────────

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl font-semibold mt-5 mb-3 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-semibold mt-4 mb-2 first:mt-0" style={{ color: "var(--foreground)" }}>{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
  code: CodeBlock,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold" style={{ color: "var(--foreground)" }}>{children}</strong>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-4 border-indigo-500 pl-4 my-4 italic" style={{ color: "var(--muted)" }}>{children}</blockquote>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} className="text-indigo-400 underline hover:text-indigo-300" target="_blank" rel="noreferrer">{children}</a>,
  hr: () => <hr className="my-6 border-zinc-700/50" />,
};

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

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Derive local messages from active conversation
  const messages: StoredMessage[] = activeConversation?.messages ?? [];

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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }, [input]);
  useEffect(() => {
    if (editingId && editRef.current) { editRef.current.focus(); editRef.current.style.height = "auto"; editRef.current.style.height = `${Math.min(editRef.current.scrollHeight, 200)}px`; }
  }, [editingId]);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); }
  }, [renamingId]);

  // Chat logic
  const handleStop = useCallback(() => { abortRef.current?.abort(); abortRef.current = null; setIsLoading(false); }, []);

  const streamChat = useCallback(async (history: { role: string; content: string }[], overrideConvId?: string) => {
    const id = overrideConvId ?? activeConversation?.id;
    if (!id) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    const aiId = crypto.randomUUID();
    const tempMsg: StoredMessage = { id: aiId, role: "assistant", content: "", timestamp: now() };
    setMessages((prev) => [...prev, tempMsg], id);

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }), signal: controller.signal });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Request failed (${res.status})`); }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let acc = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; acc += decoder.decode(value, { stream: true }); setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: acc } : m), id); }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: m.content || (err instanceof Error ? err.message : "Something went wrong") } : m), id);
    } finally { setIsLoading(false); abortRef.current = null; }
  }, [activeConversation, setMessages]);

  const handleSend = useCallback((text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    setInput("");

    // Create conversation if none active
    let convId = activeConversation?.id;
    if (!convId) {
      const conv = createConversation("");
      convId = conv.id;
      renameConversation(conv.id, content.split(" ").slice(0, 6).join(" ").substring(0, 50));
    }

    // Generate title from first user message
    if (activeConversation?.messages.length === 0) {
      const title = content.replace(/[^\w\s]/g, "").trim().split(/\s+/).slice(0, 6).join(" ") + (content.trim().split(/\s+/).length > 6 ? "..." : "");
      renameConversation(convId, title);
    }

    const userMsg: StoredMessage = { id: crypto.randomUUID(), role: "user", content, timestamp: now() };
    const currentMsgs = activeConversation?.messages ?? [];
    const updated = [...currentMsgs, userMsg];
    updateMessages(convId, updated);
    streamChat(updated.map(({ role, content }) => ({ role, content })), convId);
  }, [input, isLoading, activeConversation, createConversation, renameConversation, updateMessages, streamChat]);

  const handleRegenerate = useCallback(() => {
    const idx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (idx < 0) return;
    const msgs = messages.slice(0, idx);
    setMessages(msgs);
    streamChat(msgs.map(({ role, content }) => ({ role, content })));
  }, [messages, setMessages, streamChat]);

  const handleEditStart = (msg: StoredMessage) => { if (msg.role !== "user") return; setEditingId(msg.id); setEditValue(msg.content); };
  const handleEditSave = () => {
    if (!editingId || !editValue.trim()) return;
    const idx = messages.findIndex((m) => m.id === editingId);
    if (idx === -1) return;
    const edited = { ...messages[idx], content: editValue.trim(), timestamp: now() };
    const updated = [...messages.slice(0, idx), edited];
    setMessages(updated); setEditingId(null); setEditValue("");
    streamChat(updated.map(({ role, content }) => ({ role, content })));
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

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Render ──────────────────────────────────────
  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-[#212121]" : "bg-white"}`}
      style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>
      {/* Overlay */}
      <AnimatePresenceWrapper show={sidebarOpen}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
      </AnimatePresenceWrapper>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className={`flex-shrink-0 w-72 flex flex-col z-50 transition-transform duration-300
        ${isDark ? "bg-[#171717] border-r border-zinc-800/60" : "bg-zinc-50 border-r border-zinc-200/80"}
        ${sidebarOpen ? "fixed inset-y-0 left-0 shadow-2xl" : "hidden"} lg:relative lg:flex`}>
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
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className="size-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors" title="Rename">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="size-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/20 transition-colors" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" /></svg>
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

      {/* ── Main Area ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={`flex items-center justify-between px-4 h-14 shrink-0 border-b ${isDark ? "border-zinc-800/60 bg-[#212121]/80 backdrop-blur-xl" : "border-zinc-200/80 bg-white/80 backdrop-blur-xl"}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className={`size-8 flex items-center justify-center rounded-lg ${isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
            </button>
            <span className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {activeConversation?.title ? activeConversation.title.substring(0, 30) : "New Chat"}
            </span>
          </div>
          {isLoading && (
            <button onClick={handleStop} className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" /></svg> Stop
            </button>
          )}
        </header>

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#212121]" : "bg-zinc-50/50"}`}>
          <div className="mx-auto max-w-[850px] px-4 py-6 md:px-6 lg:px-8">
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
                        onRegenerate={msg.role === "assistant" && i === messages.length - 1 && !isLoading ? handleRegenerate : undefined} />
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
          <div className={`px-4 py-4 ${isDark ? "bg-[#212121]" : "bg-white"}`}>
            <div className="mx-auto max-w-[850px]">
              <div className={`relative flex items-end gap-2 rounded-2xl border px-4 py-3 transition-all
                ${isDark ? "border-zinc-700/50 bg-[#2a2a2a] focus-within:border-zinc-500" : "border-zinc-200/80 bg-zinc-50 focus-within:border-zinc-300"}`}>
                <button className={`shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"}`} title="Attach file">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 16.835a2.25 2.25 0 0 1-3.182-3.182l8.485-8.486a.75.75 0 0 1 1.06 1.06L8.977 14.815a.75.75 0 0 0 1.06 1.06l8.934-8.934a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" /></svg>
                </button>
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={activeConversation ? "Send a message..." : "Start a new chat..."} rows={1} style={{ minHeight: 24, maxHeight: 160 }}
                  className={`flex-1 resize-none bg-transparent px-1 py-0.5 text-sm outline-none ${isDark ? "text-white placeholder-zinc-500" : "text-zinc-900 placeholder-zinc-400"}`} />
                <button className={`shrink-0 flex items-center justify-center size-8 rounded-xl transition-colors ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"}`} title="Voice input">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-8.25a.75.75 0 0 1 0-1.5h3.75v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
                </button>
                <motion.button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
                  whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
                  whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/40 disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                </motion.button>
              </div>
              <p className={`mt-2 text-center text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>GotKai can make mistakes. Verify important information.</p>
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
    <div className="flex flex-col items-center gap-3">
      <div className="size-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-600/20">
        G
      </div>
      <h2 className="text-lg font-semibold text-zinc-300">GotKai</h2>
      <p className="text-sm text-zinc-500">Start a conversation by sending a message below.</p>
    </div>
  );
}

function ChatBubble({ message, isDark, hydrated, isStreaming, onEdit, onRegenerate }: {
  message: StoredMessage; isDark: boolean; hydrated: boolean; isStreaming: boolean; onEdit?: () => void; onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-4 px-4 py-4 group ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 mt-0.5 size-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${isUser ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-blue-500/20"}`}>
        {isUser ? "U" : "G"}
      </div>
      <div className={`flex flex-col min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed md:text-base max-w-[90%] md:max-w-[85%] ${isUser ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-md" : isDark ? "bg-[#2f2f2f] border border-zinc-700/30" : "bg-white border border-zinc-200/80 shadow-sm rounded-tl-md"}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <span className="inline-flex gap-1 py-1">
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{message.content}</ReactMarkdown>
          )}
        </div>
        <div className={`flex items-center gap-1 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "flex-row-reverse" : ""}`}>
          {hydrated && message.timestamp && (
            <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{formatDate(message.timestamp)}</span>
          )}
          <CopyMessageButton text={message.content} />
          {isUser && onEdit && (
            <button onClick={onEdit} className="flex size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
            </button>
          )}
          {!isUser && onRegenerate && (
            <button onClick={onRegenerate} className="flex size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all" title="Regenerate">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex size-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all" title="Copy message">
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-green-400"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Z" clipRule="evenodd" /></svg>
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
      <div className="max-w-[90%] md:max-w-[85%]">
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
    <div className="flex gap-4 px-4 py-4 animate-pulse">
      <div className={`shrink-0 mt-0.5 size-8 rounded-full ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
      <div className="flex flex-col gap-2 flex-1 max-w-[85%]">
        <div className={`h-4 w-3/4 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
        <div className={`h-4 w-1/2 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
        <div className={`h-4 w-2/3 rounded-lg ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
      </div>
    </div>
  );
}

// ── AnimatePresence wrapper ─────────────────────────

function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <AnimatePresence>{children}</AnimatePresence>;
}
