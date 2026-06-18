import { NextRequest, NextResponse } from "next/server";

// MCP servers stored server-side (can also be loaded from env/config)
type MCPServerEntry = {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
};

// In-memory server registry (extendable via env or admin API)
const serverRegistry = new Map<string, MCPServerEntry>();

// Initialize from env var (comma-separated: name|url|header:value)
function initRegistry(): void {
  if (serverRegistry.size > 0) return;
  const raw = process.env.MCP_SERVERS;
  if (!raw) return;
  for (const entry of raw.split(",")) {
    const [name, url, ...headers] = entry.split("|");
    if (name && url) {
      const id = `mcp_${name.toLowerCase().replace(/\s+/g, "_")}`;
      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        const [k, v] = h.split(":");
        if (k && v) headerMap[k] = v;
      }
      serverRegistry.set(id, { id, name, url, headers: headerMap });
    }
  }
}

export async function POST(req: NextRequest) {
  initRegistry();

  try {
    const { serverId, request } = await req.json();
    if (!serverId || !request) {
      return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
    }

    const server = serverRegistry.get(serverId);
    if (!server) {
      return NextResponse.json({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: `Server "${serverId}" not found` } }, { status: 404 });
    }

    // Forward JSON-RPC request to MCP server
    const res = await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(server.headers || {}),
      },
      body: JSON.stringify(request),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, { status: 500 });
  }
}

// GET: list registered servers
export async function GET() {
  initRegistry();
  const servers = Array.from(serverRegistry.values()).map(({ id, name, url }) => ({ id, name, url }));
  return NextResponse.json({ servers });
}
