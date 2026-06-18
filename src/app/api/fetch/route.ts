import { NextRequest, NextResponse } from "next/server";

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1), 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "Untitled";
}

async function fetchYouTubeTranscript(videoId: string): Promise<{ title: string; content: string }> {
  // Fetch video page for title
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const pageHtml = await pageRes.text();
  const title = extractTitle(pageHtml);

  // Try to get captions via the innertube API
  try {
    const infoRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const info = await infoRes.json();
    const videoTitle = info.title || title;

    // Fetch transcript from youtubetranscript.com (free, no API key)
    const transcriptRes = await fetch(
      `https://youtubetranscript.com/?v=${videoId}&format=json`,
      { headers: { "Accept": "application/json" } },
    );
    if (transcriptRes.ok) {
      const data = await transcriptRes.json();
      if (Array.isArray(data)) {
        const text = data.map((s: { text: string }) => s.text).join(" ");
        return { title: videoTitle, content: text };
      }
    }
  } catch {}

  return { title, content: "[Transcript unavailable]" };
}

export async function POST(req: NextRequest) {
  try {
    const { url, type } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // YouTube video
    if (type === "youtube" || url.includes("youtube.com/watch") || url.includes("youtu.be/")) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (!videoId) {
        return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      }
      const result = await fetchYouTubeTranscript(videoId);
      return NextResponse.json({
        title: result.title,
        content: result.content,
        source: url,
        sourceType: "youtube",
      });
    }

    // Web page
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GotKai/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const title = extractTitle(html);
    const content = stripHtml(html).substring(0, 50000);

    return NextResponse.json({
      title,
      content,
      source: url,
      sourceType: "webpage",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
