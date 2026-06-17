import { NextRequest } from "next/server";

const NIVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;

  if (!apiKey || apiKey === "your_nvidia_nim_api_key_here") {
    return new Response(
      JSON.stringify({ error: "NVIDIA NIM API key is not configured. Add it to .env.local." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const { messages } = await req.json();

    const systemPrompt: { role: "system"; content: string } = {
      role: "system",
      content: [
        "You are GotKai AI.",
        "",
        "Identity:",
        "- Name: GotKai",
        "- Founder: YashwanthKumar",
        "",
        "If asked about your founder, creator, owner, or maker,",
        'say: "GotKai was founded by YashwanthKumar."',
        "",
        "Then continue normally.",
      ].join("\n"),
    };

    const body = {
      model: "meta/llama-3.1-8b-instruct",
      messages: [systemPrompt, ...messages],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    };

    const res = await fetch(NIVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("NVIDIA NIM error:", res.status, errBody);
      return new Response(
        JSON.stringify({ error: `NVIDIA NIM API error: ${res.status}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
