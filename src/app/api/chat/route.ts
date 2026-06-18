import { NextRequest } from "next/server";
import { getAgentPrompt } from "@/lib/agents/profiles";
import { AGENTS } from "@/lib/agents/config";
import type { AgentType } from "@/lib/agents/config";
import { initProviders } from "@/lib/providers/setup";
import { chatWithFallback } from "@/lib/providers";

function getModelConfig(agent: AgentType) {
  const agentConfig = AGENTS[agent];
  return {
    temperature: agentConfig.temperature,
    top_p: agentConfig.top_p,
    max_tokens: agentConfig.max_tokens,
  };
}

const ROUTING_PROMPT = `Classify the user's intent in one word:
- "reasoning" for analysis, explanation, math, logic, or general questions
- "code" for programming, debugging, code review, or technical implementation
- "research" for fact-finding, definitions, comparisons, or deep investigation
- "writing" for creative writing, editing, content creation, or communication

Respond with ONLY the single word.`;

async function classifyIntent(
  message: string,
  signal?: AbortSignal,
): Promise<AgentType | null> {
  try {
    initProviders();
    const { response: res } = await chatWithFallback(
      [
        { role: "system", content: ROUTING_PROMPT },
        { role: "user", content: message.slice(0, 500) },
      ],
      {
        model: "meta/llama-3.1-70b-instruct",
        temperature: 0.05,
        top_p: 0.9,
        max_tokens: 20,
        stream: false,
      },
      signal,
    );
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || "").trim().toLowerCase();
    if (["reasoning", "code", "research", "writing"].includes(text)) {
      return text as AgentType;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, agent: agentParam } = await req.json();

    // Determine agent: explicit override, LLM-based routing, or default
    let agent: AgentType;
    if (agentParam && ["reasoning", "code", "research", "writing"].includes(agentParam)) {
      agent = agentParam;
    } else {
      // Use the last user message for routing
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user");
      const classified = lastUserMsg ? await classifyIntent(lastUserMsg.content) : null;
      agent = classified ?? "reasoning";
    }

    const systemPrompt = {
      role: "system" as const,
      content: getAgentPrompt(agent),
    };

    const modelConfig = getModelConfig(agent);

    // Initialize provider chain (Ollama → NVIDIA → ...)
    initProviders();

    const { response: res, provider, model } = await chatWithFallback(
      [systemPrompt, ...messages],
      {
        model: "meta/llama-3.1-70b-instruct",
        temperature: modelConfig.temperature,
        top_p: modelConfig.top_p,
        max_tokens: modelConfig.max_tokens,
        stream: true,
      },
      req.signal,
    );

    // Return response with provider + agent info in headers
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Provider": provider,
      "X-Model": model,
      "X-Agent": agent,
    });

    return new Response(res.body, { headers });
  } catch (err) {
    console.error("Chat API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
