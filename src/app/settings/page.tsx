"use client";

import { useTheme } from "@/lib/theme-context";

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();

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

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
            <h2 className={`text-base font-semibold mb-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Appearance</h2>
            <p className={`text-sm mb-6 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>Customize how GotKai looks.</p>

            <div className={`rounded-xl border ${isDark ? "border-zinc-800/60 bg-[#1a1a1a]" : "border-zinc-200/80 bg-zinc-50"}`}>
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 text-zinc-400"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 text-zinc-500"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" /></svg>
                  )}
                  <div>
                    <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Theme</div>
                    <div className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isDark ? "Dark mode" : "Light mode"}</div>
                  </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
