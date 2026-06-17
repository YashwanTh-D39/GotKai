export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 md:px-16 md:py-6">
        <div className="text-lg sm:text-xl font-bold tracking-tight">GotKai</div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#" className="hover:text-white transition-colors">Features</a>
          <a href="#" className="hover:text-white transition-colors">About</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
        </nav>
        <a
          href="/chat"
          className="rounded-full bg-white px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Get Started
        </a>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 md:px-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 text-xs text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Powered by next-generation AI
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            Think Faster with{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              GotKai
            </span>
          </h1>

          <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400 md:text-lg">
            The AI assistant that understands context, adapts to your workflow,
            and helps you ship better work — faster. Experience intelligence
            that feels human.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/chat"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 sm:w-auto"
            >
              Start Chatting
            </a>
            <a
              href="#"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-800 px-8 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white sm:w-auto"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-20 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: "Real-time Reasoning", desc: "Get answers in seconds with chain-of-thought processing." },
            { title: "Code & Content", desc: "Write, debug, and refactor code or generate content on the fly." },
            { title: "Your Data Stays Yours", desc: "Enterprise-grade encryption with zero data retention." },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm transition-colors hover:border-zinc-700"
            >
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-900 px-6 py-6 text-center text-xs text-zinc-600 md:px-16">
        &copy; {new Date().getFullYear()} GotKai. All rights reserved.
      </footer>
    </div>
  );
}
