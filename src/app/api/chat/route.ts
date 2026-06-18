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

export async function POST(req: NextRequest) {
  try {
    const { messages, agent: agentParam } = await req.json();

    // Use the agent provided by the client (regex-based routing) or default to reasoning
    const agent: AgentType =
      agentParam && ["reasoning", "code", "research", "writing"].includes(agentParam)
        ? agentParam
        : "reasoning";

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
