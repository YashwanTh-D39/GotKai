"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTheme } from "@/lib/theme-context";
import {
  getMemoriesByCategory,
  searchMemories,
  removeMemory,
  updateMemory,
  addMemoryFact,
  clearMemory,
  getMemoryStats,
  type MemoryFact,
  type MemoryCategory,
} from "@/lib/memory";
import {
  VOICE_PROFILES,
  getVoiceProfile,
  loadVoiceSettings,
  saveVoiceSettings,
  speak,
  stopSpeech,
  ensureVoices,
  PITCH_MIN, PITCH_MAX, PITCH_STEP,
  RATE_MIN, RATE_MAX, RATE_STEP,
  type VoiceSettings,
} from "@/lib/voice";

const CATEGORIES: { key: MemoryCategory | "all"; label: string; color: string }[] = [
  { key: "all", label: "All", color: "" },
  { key: "preference", label: "Preferences", color: "text-emerald-400" },
  { key: "fact", label: "Facts", color: "text-blue-400" },
  { key: "identity", label: "Identity", color: "text-purple-400" },
  { key: "learning", label: "Learning", color: "text-amber-400" },
  { key: "correction", label: "Corrections", color: "text-red-400" },
];

const CONFIDENCE_COLOR = (c: number) => (c >= 0.7 ? "bg-emerald-500" : c >= 0.4 ? "bg-amber-500" : "bg-red-500");
const CATEGORY_EMOJI: Record<string, string> = {
  preference: "⭐",
  fact: "📌",
  identity: "👤",
  learning: "📚",
  correction: "🔧",
};

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();
  const [tab, setTab] = useState<"appearance" | "memory" | "voice">("memory");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addCategory, setAddCategory] = useState<MemoryCategory>("fact");
  const [stats, setStats] = useState({ total: 0, byCategory: {} as Record<string, number>, avgConfidence: 0 });
  const [memories, setMemories] = useState<MemoryFact[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const voicesInitialized = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !voicesInitialized.current) {
      voicesInitialized.current = true;
      ensureVoices().catch(() => {});
    }
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setStats(getMemoryStats());
    if (categoryFilter === "all") {
      setMemories(searchMemories(search));
    } else {
      setMemories(getMemoriesByCategory(categoryFilter).filter(
        (m) => !search || m.content.toLowerCase().includes(search.toLowerCase()) || m.tags.some((t) => t.includes(search)),
      ));
    }
  }, [refreshKey, categoryFilter, search]);

  const handleDelete = (id: string) => {
    removeMemory(id);
    refresh();
  };

  const handleEditSave = (id: string) => {
    if (editContent.trim()) {
      updateMemory(id, { content: editContent.trim() });
      setEditingId(null);
      refresh();
    }
  };

  const handleAdd = () => {
    if (addContent.trim()) {
      addMemoryFact(addContent.trim(), addCategory, "explicit");
      setAddContent("");
      refresh();
    }
  };

  const handleClearAll = () => {
    clearMemory();
    refresh();
  };

  const filteredMemories = useMemo(() => memories, [memories]);

  const updateVoice = useCallback((partial: Partial<VoiceSettings>) => {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...partial };
      saveVoiceSettings(next);
      return next;
    });
  }, []);

  const handlePreviewVoice = useCallback((voiceId: string) => {
    if (previewingId === voiceId) {
      stopSpeech();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(voiceId);
    const profile = getVoiceProfile(voiceId);
    if (profile) {
      speak("Hello! I'm GotKai, your AI assistant. How can I help you today?", profile, voiceSettings);
      setTimeout(() => setPreviewingId(null), 3000);
    }
  }, [previewingId, voiceSettings]);

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-[#212121]" : "bg-white"}`}
      style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>
      <div className="flex-1 flex flex-col">
        <header className={`flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14 shrink-0 border-b ${isDark ? "border-zinc-800/60 bg-[#212121]/80" : "border-zinc-200/80 bg-white/80"}`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/chat"
              className={`size-7 sm:size-8 flex items-center justify-center rounded-lg ${isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" /></svg>
            </a>
            <h1 className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Settings</h1>
          </div>
        </header>

        {/* Tab bar */}
        <div className={`flex gap-0 px-4 border-b ${isDark ? "border-zinc-800/60" : "border-zinc-200/80"}`}>
          <button onClick={() => setTab("memory")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tab === "memory"
                ? isDark ? "text-white border-indigo-400" : "text-zinc-900 border-indigo-600"
                : isDark ? "text-zinc-500 border-transparent hover:text-zinc-300" : "text-zinc-400 border-transparent hover:text-zinc-600"}`}>
            Memory
          </button>
          <button onClick={() => setTab("appearance")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tab === "appearance"
                ? isDark ? "text-white border-indigo-400" : "text-zinc-900 border-indigo-600"
                : isDark ? "text-zinc-500 border-transparent hover:text-zinc-300" : "text-zinc-400 border-transparent hover:text-zinc-600"}`}>
            Appearance
          </button>
          <button onClick={() => setTab("voice")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tab === "voice"
                ? isDark ? "text-white border-indigo-400" : "text-zinc-900 border-indigo-600"
                : isDark ? "text-zinc-500 border-transparent hover:text-zinc-300" : "text-zinc-400 border-transparent hover:text-zinc-600"}`}>
            Voice
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">

            {/* ── Memory Tab ──────────────────────────── */}
            {tab === "memory" && (
              <>
                {/* Stats bar */}
                <div className="flex items-center gap-4 mb-5">
                  <div className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    <span className="font-semibold text-base" style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>{stats.total}</span> memories
                  </div>
                  <div className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    <span className="font-semibold" style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>{Math.round(stats.avgConfidence * 100)}%</span> avg confidence
                  </div>
                </div>

                {/* Search + Add row */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={`flex-1 flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700/50 bg-zinc-800/30" : "border-zinc-200/80 bg-white"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0 text-zinc-500"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" /></svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories..."
                      className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-zinc-300 placeholder-zinc-500" : "text-zinc-700 placeholder-zinc-400"}`} />
                  </div>
                </div>

                {/* Category filter chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.key} onClick={() => setCategoryFilter(cat.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                        ${categoryFilter === cat.key
                          ? isDark ? "bg-zinc-700 text-zinc-200" : "bg-zinc-200 text-zinc-800"
                          : isDark ? "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"}`}>
                      {cat.key !== "all" && <span className={`mr-1 ${cat.color}`}>{CATEGORY_EMOJI[cat.key] || "•"}</span>}
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Memory list */}
                <div className="space-y-2">
                  {filteredMemories.length === 0 ? (
                    <div className={`text-center py-12 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      <p className="text-sm">No memories yet. Chat with GotKai to build your memory profile.</p>
                    </div>
                  ) : (
                    filteredMemories.map((fact) => (
                      <div key={fact.id}
                        className={`rounded-xl border transition-all ${isDark ? "border-zinc-800/60 bg-[#1a1a1a] hover:border-zinc-700/50" : "border-zinc-200/80 bg-zinc-50 hover:border-zinc-300"}`}>
                        {editingId === fact.id ? (
                          <div className="p-3">
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                              className={`w-full resize-none rounded-lg px-3 py-2 text-sm outline-none border ${isDark ? "bg-zinc-800 text-zinc-200 border-zinc-700" : "bg-white text-zinc-800 border-zinc-300"}`}
                              style={{ minHeight: 60 }} />
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <button onClick={() => setEditingId(null)}
                                className={`px-3 py-1 rounded-lg text-xs ${isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"}`}>Cancel</button>
                              <button onClick={() => handleEditSave(fact.id)}
                                className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[11px] font-medium ${CATEGORIES.find((c) => c.key === fact.category)?.color || "text-zinc-400"}`}>
                                    {CATEGORY_EMOJI[fact.category] || "•"} {fact.category}
                                  </span>
                                  <span className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                                    {formatRelative(fact.createdAt)} · seen {fact.observedCount}x
                                  </span>
                                </div>
                                <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{fact.content}</p>
                                {/* Tags */}
                                {fact.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {fact.tags.map((tag) => (
                                      <span key={tag}
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-500"}`}>
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => { setEditingId(fact.id); setEditContent(fact.content); }}
                                  className={`size-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(fact.id)}
                                  className="size-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/20 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" /></svg>
                                </button>
                              </div>
                            </div>
                            {/* Confidence bar */}
                            <div className="mt-2 flex items-center gap-2">
                              <div className={`flex-1 h-1 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
                                <div className={`h-full rounded-full transition-all ${CONFIDENCE_COLOR(fact.confidence)}`}
                                  style={{ width: `${Math.round(fact.confidence * 100)}%` }} />
                              </div>
                              <span className={`text-[10px] font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                                {Math.round(fact.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add memory form */}
                <div className={`mt-6 rounded-xl border p-3 ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Add a memory fact</p>
                  <div className="flex items-center gap-2">
                    <select value={addCategory} onChange={(e) => setAddCategory(e.target.value as MemoryCategory)}
                      className={`rounded-lg px-2 py-1.5 text-xs border outline-none ${isDark ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-white text-zinc-700 border-zinc-300"}`}>
                      <option value="fact">Fact</option>
                      <option value="preference">Preference</option>
                      <option value="identity">Identity</option>
                      <option value="learning">Learning</option>
                      <option value="correction">Correction</option>
                    </select>
                    <input value={addContent} onChange={(e) => setAddContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                      placeholder="E.g., I love hiking on weekends"
                      className={`flex-1 rounded-lg px-3 py-1.5 text-sm outline-none border ${isDark ? "bg-zinc-800 text-zinc-200 border-zinc-700 placeholder-zinc-500" : "bg-white text-zinc-800 border-zinc-300 placeholder-zinc-400"}`} />
                    <button onClick={handleAdd} disabled={!addContent.trim()}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">Add</button>
                  </div>
                </div>

                {/* Clear all */}
                {stats.total > 0 && (
                  <button onClick={handleClearAll}
                    className={`mt-4 text-xs ${isDark ? "text-zinc-600 hover:text-red-400" : "text-zinc-400 hover:text-red-500"} transition-colors`}>
                    Clear all memories
                  </button>
                )}
              </>
            )}

            {/* ── Appearance Tab ───────────────────────── */}
            {tab === "appearance" && (
              <>
                <h2 className={`text-base font-semibold mb-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Appearance</h2>
                <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Customize how GotKai looks.</p>
                <div className={`rounded-xl border ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
                  <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Theme</span>
                    </div>
                    <button onClick={toggleTheme}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? "bg-indigo-600" : "bg-zinc-300"}`}>
                      <span className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${isDark ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className={`text-base font-semibold mb-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>About</h2>
                  <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Version and information.</p>
                  <div className={`rounded-xl border ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
                    <div className="flex items-center justify-between px-4 py-4">
                      <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Version</span>
                      <span className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>1.0.0</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Voice Tab ──────────────────────────── */}
            {tab === "voice" && (
              <>
                <h2 className={`text-base font-semibold mb-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Voice</h2>
                <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Choose a voice and customize how GotKai speaks.</p>

                {/* Voice profile cards */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mb-6">
                  {VOICE_PROFILES.map((v) => (
                    <button key={v.id} onClick={() => updateVoice({ activeVoiceId: v.id })}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        voiceSettings.activeVoiceId === v.id
                          ? isDark ? "border-indigo-500 bg-indigo-500/10" : "border-indigo-500 bg-indigo-50"
                          : isDark ? "border-zinc-800/60 bg-[#1a1a1a] hover:border-zinc-700/50" : "border-zinc-200/80 bg-zinc-50 hover:border-zinc-300"
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{v.emoji}</span>
                        <button onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.id); }}
                          className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                            previewingId === v.id
                              ? "bg-indigo-600 text-white"
                              : isDark ? "bg-zinc-800 text-zinc-400 hover:text-zinc-200" : "bg-zinc-200 text-zinc-500 hover:text-zinc-700"
                          }`}>
                          {previewingId === v.id ? "Playing..." : "Preview"}
                        </button>
                      </div>
                      <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{v.name}</div>
                      <div className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{v.description}</div>
                    </button>
                  ))}
                </div>

                {/* Pitch slider */}
                <div className={`rounded-xl border p-4 mb-3 ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Pitch</span>
                    <span className={`text-xs font-mono ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{voiceSettings.pitch.toFixed(1)}</span>
                  </div>
                  <input type="range" min={PITCH_MIN} max={PITCH_MAX} step={PITCH_STEP} value={voiceSettings.pitch}
                    onChange={(e) => updateVoice({ pitch: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500" />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={isDark ? "text-zinc-600" : "text-zinc-400"}>Low</span>
                    <span className={isDark ? "text-zinc-600" : "text-zinc-400"}>High</span>
                  </div>
                </div>

                {/* Rate slider */}
                <div className={`rounded-xl border p-4 mb-6 ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Speed</span>
                    <span className={`text-xs font-mono ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{voiceSettings.rate.toFixed(1)}</span>
                  </div>
                  <input type="range" min={RATE_MIN} max={RATE_MAX} step={RATE_STEP} value={voiceSettings.rate}
                    onChange={(e) => updateVoice({ rate: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500" />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={isDark ? "text-zinc-600" : "text-zinc-400"}>Slow</span>
                    <span className={isDark ? "text-zinc-600" : "text-zinc-400"}>Fast</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className={`rounded-xl border divide-y ${isDark ? "border-zinc-800/60 bg-[#1a1a1a] divide-zinc-800/60" : "border-zinc-200/80 bg-zinc-50 divide-zinc-200/80"}`}>
                  <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                    <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Auto-read responses</span>
                    <input type="checkbox" checked={voiceSettings.autoTTS}
                      onChange={(e) => updateVoice({ autoTTS: e.target.checked })}
                      className="size-4 accent-indigo-500 rounded" />
                  </label>
                  <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                    <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Continuous voice conversation</span>
                    <input type="checkbox" checked={voiceSettings.continuousMode}
                      onChange={(e) => updateVoice({ continuousMode: e.target.checked })}
                      className="size-4 accent-indigo-500 rounded" />
                  </label>
                  <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                    <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Voice input enabled</span>
                    <input type="checkbox" checked={voiceSettings.voiceInputEnabled}
                      onChange={(e) => updateVoice({ voiceInputEnabled: e.target.checked })}
                      className="size-4 accent-indigo-500 rounded" />
                  </label>
                  <label className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                    <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Expressive speech</span>
                    <input type="checkbox" checked={voiceSettings.emotionEnabled}
                      onChange={(e) => updateVoice({ emotionEnabled: e.target.checked })}
                      className="size-4 accent-indigo-500 rounded" />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
