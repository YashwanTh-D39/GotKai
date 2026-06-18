import { NextRequest } from "next/server";
import { initProviders } from "@/lib/providers/setup";
import { chatWithFallback } from "@/lib/providers";

const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation below and extract facts about the user. Return ONLY a JSON array (no markdown, no explanation). Each object must have:
- "content": the fact statement (e.g. "User works at Google")
- "category": one of "preference", "fact", "identity", "learning", "correction"

Rules:
- Only extract clear, specific facts, not vague statements
- Skip greetings, pleasantries, and general knowledge
- Extract preferences ("likes", "enjoys", "prefers")
- Extract identity facts ("name is", "works as", "lives in")
- Extract learning signals ("learnt", "studied", "discovered")
- Extract corrections when user corrects the AI
- Return [] if nothing worth extracting`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ facts: [] });
    }

    initProviders();

    const conversationText = messages
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .slice(-6)
      .join("\n\n");

    const systemMsg = { role: "system" as const, content: EXTRACTION_PROMPT };
    const userMsg = { role: "user" as const, content: `Extract facts from this conversation:\n\n${conversationText}` };

    const { response: res } = await chatWithFallback(
      [systemMsg, userMsg],
      {
        model: "meta/llama-3.1-70b-instruct",
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 512,
        stream: false,
      },
      req.signal,
    );

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content || "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return Response.json({ facts: [] });
    }

    let facts: { content: string; category: string }[];
    try {
      facts = JSON.parse(jsonMatch[0]);
    } catch {
      return Response.json({ facts: [] });
    }

    return Response.json({
      facts: facts.filter(
        (f) => f.content && f.content.length > 5 && ["preference", "fact", "identity", "learning", "correction"].includes(f.category),
      ).slice(0, 3),
    });
  } catch {
    return Response.json({ facts: [] });
  }
}
