"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/theme-context";
import type { AuthMode } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    user, loading, error, setError, mode, setMode, clearError,
    signIn, signUp, signInWithOAuth, resetPassword,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (user) router.push("/chat");
  }, [user, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setError("Social login failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setError]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    let success = false;
    if (mode === "signin") {
      success = await signIn(email, password);
    } else if (mode === "signup") {
      success = await signUp(email, password);
    } else if (mode === "reset") {
      success = await resetPassword(email);
      if (success) setResetSent(true);
    }

    if (success && mode !== "reset") {
      router.push("/chat");
    }
    setIsSubmitting(false);
  }, [email, password, mode, signIn, signUp, resetPassword, clearError, router]);

  const switchMode = useCallback((m: AuthMode) => {
    setMode(m);
    clearError();
    setResetSent(false);
  }, [setMode, clearError]);

  const formTitle = mode === "signin" ? "Welcome Back"
    : mode === "signup" ? "Create Account"
    : "Reset Password";

  const formDesc = mode === "signin" ? "Enter your credentials to continue"
    : mode === "signup" ? "Start your journey with GotKai"
    : "We'll send you a reset link";

  const bg = isDark ? "#05050a" : "#fafafa";
  const cardBg = isDark ? "bg-white/5" : "bg-black/[0.03]";
  const borderClr = isDark ? "border-white/10" : "border-black/10";
  const inputBg = isDark ? "bg-white/5" : "bg-black/[0.04]";
  const inputBorder = isDark ? "border-white/10" : "border-black/10";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const textSubtle = isDark ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, color: isDark ? "#e4e4e7" : "#18181b" }}>
      <nav className={`fixed top-0 left-0 right-0 h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 md:px-12 z-50
        backdrop-blur-xl border-b ${isDark ? "bg-[#05050a]/80 border-white/5" : "bg-[#fafafa]/80 border-black/5"}`}>
        <a href="/" className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          GotKai
        </a>
        <div className="flex items-center gap-4 sm:gap-6">
          <a href="/" className={`text-xs sm:text-sm ${textMuted} hover:opacity-80 transition-opacity`}>Home</a>
          <a href="/chat"
            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-xs sm:text-sm font-medium
              text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 hover:shadow-indigo-600/40">
            Try Chat
          </a>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-24 sm:py-32 mt-16 sm:mt-20">
        <div className="w-full max-w-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs mb-6
              ${isDark ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" : "border-indigo-500/15 bg-indigo-500/5 text-indigo-600"}`}>
              <span className={`size-2 rounded-full ${isDark ? "bg-indigo-400" : "bg-indigo-600"} animate-pulse`} />
              Welcome to GotKai
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{formTitle}</h1>
            <p className={`text-sm ${textMuted}`}>{formDesc}</p>
          </motion.div>

          {resetSent ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`text-center p-8 rounded-2xl border backdrop-blur-sm
                ${isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-500/20 bg-emerald-500/[0.03]"}`}>
              <svg className="size-12 mx-auto text-emerald-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
              <p className={`text-sm ${textMuted}`}>Reset link sent to <strong style={{ color: isDark ? "#e4e4e7" : "#18181b" }}>{email}</strong></p>
              <button onClick={() => switchMode("signin")}
                className={`mt-6 text-sm transition-colors underline underline-offset-4
                  ${isDark ? "text-indigo-400 hover:text-indigo-300 decoration-indigo-500/30" : "text-indigo-600 hover:text-indigo-700 decoration-indigo-500/30"}`}>
                Back to Sign In
              </button>
            </motion.div>
          ) : (
            <motion.form onSubmit={handleSubmit} key={mode}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="space-y-4">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed flex items-start gap-2">
                  <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{error}</span>
                </motion.div>
              )}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Email</label>
                <input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200
                    focus:border-indigo-500/60 focus:ring-[3px] focus:ring-indigo-500/15
                    ${inputBg} ${inputBorder}`}
                  style={{ color: isDark ? "#e4e4e7" : "#18181b" }} />
              </div>
              {mode !== "reset" && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Password</label>
                  <input type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200
                      focus:border-indigo-500/60 focus:ring-[3px] focus:ring-indigo-500/15
                      ${inputBg} ${inputBorder}`}
                    style={{ color: isDark ? "#e4e4e7" : "#18181b" }} />
                </div>
              )}
              {mode === "signin" && (
                <div className="flex justify-end text-sm">
                  <button type="button" onClick={() => switchMode("reset")}
                    className={`transition-colors underline underline-offset-4
                      ${isDark ? "text-indigo-400/80 hover:text-indigo-300 decoration-indigo-500/20" : "text-indigo-600/80 hover:text-indigo-700 decoration-indigo-500/20"}`}>
                    Forgot password?
                  </button>
                </div>
              )}
              <button type="submit" disabled={isSubmitting || loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm
                  shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-indigo-600/40
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
              </button>

              {mode !== "reset" && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${isDark ? "border-white/5" : "border-black/5"}`} />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className={`px-3 ${textSubtle}`} style={{ background: bg }}>or continue with</span>
                  </div>
                </div>
              )}

              {mode !== "reset" && (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => signInWithOAuth("google")} disabled={isSubmitting || loading}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all
                      hover:border-indigo-500/30 hover:bg-indigo-500/5 disabled:opacity-50 disabled:cursor-not-allowed
                      ${borderClr} ${cardBg}`}
                    style={{ color: isDark ? "#d4d4d8" : "#52525b" }}>
                    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" onClick={() => signInWithOAuth("github")} disabled={isSubmitting || loading}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all
                      hover:border-indigo-500/30 hover:bg-indigo-500/5 disabled:opacity-50 disabled:cursor-not-allowed
                      ${borderClr} ${cardBg}`}
                    style={{ color: isDark ? "#d4d4d8" : "#52525b" }}>
                    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                </div>
              )}

              <p className={`text-center text-sm ${textSubtle}`}>
                {mode === "signin" ? (
                  <>Don&apos;t have an account?{" "}
                    <button type="button" onClick={() => switchMode("signup")}
                      className={`transition-colors underline underline-offset-4
                        ${isDark ? "text-indigo-400 hover:text-indigo-300 decoration-indigo-500/30" : "text-indigo-600 hover:text-indigo-700 decoration-indigo-500/30"}`}>Register</button>
                  </>
                ) : mode === "signup" ? (
                  <>Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("signin")}
                      className={`transition-colors underline underline-offset-4
                        ${isDark ? "text-indigo-400 hover:text-indigo-300 decoration-indigo-500/30" : "text-indigo-600 hover:text-indigo-700 decoration-indigo-500/30"}`}>Sign In</button>
                  </>
                ) : (
                  <button type="button" onClick={() => switchMode("signin")}
                    className={`transition-colors underline underline-offset-4
                      ${isDark ? "text-indigo-400 hover:text-indigo-300 decoration-indigo-500/30" : "text-indigo-600 hover:text-indigo-700 decoration-indigo-500/30"}`}>Back to Sign In</button>
                )}
              </p>
            </motion.form>
          )}
        </div>
      </main>
    </div>
  );
}
