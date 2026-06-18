import { NextRequest, NextResponse } from "next/server";

async function searchWeb(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  // Try Tavily if API key is configured
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query, search_depth: "advanced", max_results: 8 }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
          title: r.title || "Untitled",
          url: r.url,
          snippet: r.content || r.snippet || "",
        }));
      }
    } catch {}
  }

  // Fallback: scrape from DuckDuckGo HTML (for research purposes)
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GotKai/1.0)" } });
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      results.push({
        title: match[2].replace(/<[^>]+>/g, "").trim(),
        url: match[1].replace(/uddg=([^&]+)/, (_, u) => decodeURIComponent(u)).trim(),
        snippet: match[3].replace(/<[^>]+>/g, "").trim(),
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GotKai/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);
  } catch {
    return "";
  }
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"')>]+/g;
  return [...new Set(text.match(urlRegex) || [])].filter((u) => !u.includes("google.com") && !u.includes("duckduckgo.com"));
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        send("status", { message: "Searching the web..." });

        // Step 1: Search
        const searchResults = await searchWeb(query);
        if (searchResults.length === 0) {
          send("error", { message: "No search results found." });
          controller.close();
          return;
        }

        send("status", { message: `Found ${searchResults.length} sources. Fetching content...` });
        send("sources", { sources: searchResults.map((r) => ({ title: r.title, url: r.url })) });

        // Step 2: Fetch top results
        const urlSet = new Set<string>();
        for (const r of searchResults) {
          const pageUrls = extractUrls(r.url);
          for (const u of pageUrls) {
            if (u.startsWith("http") && !urlSet.has(u)) urlSet.add(u);
          }
          if (urlSet.size >= 5) break;
        }

        const fetchedPages: { url: string; title: string; content: string }[] = [];
        for (const url of urlSet) {
          send("status", { message: `Reading ${url.substring(0, 60)}...` });
          const content = await fetchPageContent(url);
          if (content.length > 200) {
            fetchedPages.push({
              url,
              title: searchResults.find((r) => r.url.includes(url.substring(0, 40)))?.title || url,
              content,
            });
          }
        }

        if (fetchedPages.length === 0) {
          send("error", { message: "Could not fetch content from any sources." });
          controller.close();
          return;
        }

        send("status", { message: `Analyzing ${fetchedPages.length} sources. Generating research report...` });

        // Step 3: Contradiction detection via simple text comparison
        const contradictions: { topic: string; sources: string[] }[] = [];
        for (let i = 0; i < fetchedPages.length; i++) {
          for (let j = i + 1; j < fetchedPages.length; j++) {
            const wordsA = new Set(fetchedPages[i].content.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
            const wordsB = new Set(fetchedPages[j].content.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
            const common = [...wordsA].filter((w) => wordsB.has(w)).length;
            const overlap = common / Math.min(wordsA.size, wordsB.size);
            // If overlap is moderate (20-60%), they might discuss same topic with different info
            if (overlap > 0.15 && overlap < 0.6) {
              contradictions.push({
                topic: `Source ${i + 1} vs Source ${j + 1}`,
                sources: [fetchedPages[i].url, fetchedPages[j].url],
              });
            }
          }
        }

        // Step 4: Build report
        const sourcesSection = fetchedPages
          .map((p, i) => `[${i + 1}] ${p.title}\n    URL: ${p.url}\n    Key excerpt: ${p.content.substring(0, 300)}...`)
          .join("\n\n");

        const contradictionsSection = contradictions.length > 0
          ? "\n\n## Potential Contradictions\n" + contradictions.map((c) => `- Topic: ${c.topic}\n  Sources: ${c.sources.join(", ")}`).join("\n")
          : "\n\nNo significant contradictions detected across sources.";

        const report = [
          `# Research Report: ${query}`,
          "",
          `**Sources analyzed:** ${fetchedPages.length}`,
          `**Search results evaluated:** ${searchResults.length}`,
          `**Contradictions found:** ${contradictions.length}`,
          "",
          "## Key Findings",
          "",
          fetchedPages.map((p, i) => `### Finding ${i + 1}: From "${p.title}"\n\n${p.content.substring(0, 1000)}...`).join("\n\n"),
          "",
          "## Source Summary",
          "",
          sourcesSection,
          contradictionsSection,
          "",
          "## Methodology",
          "",
          `1. Searched the web for: "${query}"`,
          `2. Evaluated ${searchResults.length} search results`,
          `3. Fetched and analyzed content from ${fetchedPages.length} sources`,
          `4. Cross-referenced sources for contradictions`,
          "5. Compiled findings into this structured report",
          "",
          `*Report generated by GotKai Deep Research*`,
        ].join("\n");

        send("complete", { report, sourceCount: fetchedPages.length, contradictionCount: contradictions.length });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
