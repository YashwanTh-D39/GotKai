import type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPToolCall,
  MCPToolResult,
  JSONRPCRequest,
  JSONRPCResponse,
} from "./types";
import { MCP_METHODS } from "./types";

const SERVER_STORAGE_KEY = "gotkai_mcp_servers";

function loadServers(): MCPServerConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveServers(servers: MCPServerConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(servers));
  } catch {}
}

function makeRequest(method: string, params?: Record<string, unknown>): JSONRPCRequest {
  return { jsonrpc: "2.0", id: crypto.randomUUID?.() || Date.now(), method, params };
}

class MCPSession {
  private server: MCPServerConfig;
  private abort?: AbortController;

  constructor(server: MCPServerConfig) {
    this.server = server;
  }

  async connect(): Promise<void> {
    if (this.server.transport !== "sse" || !this.server.url) {
      throw new Error(`Transport ${this.server.transport} not supported in browser`);
    }
    // For SSE, we use the proxy API route
  }

  async listTools(): Promise<MCPTool[]> {
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverId: this.server.id,
        request: makeRequest(MCP_METHODS.TOOLS_LIST),
      }),
    });
    if (!res.ok) throw new Error(`MCP error: ${res.status}`);
    const rpc: JSONRPCResponse = await res.json();
    if (rpc.error) throw new Error(`MCP error: ${rpc.error.message}`);
    const result = rpc.result as { tools: MCPTool[] };
    return result?.tools || [];
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    this.abort = new AbortController();
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: this.server.id,
          request: makeRequest(MCP_METHODS.TOOLS_CALL, toolCall),
        }),
        signal: this.abort.signal,
      });
      if (!res.ok) throw new Error(`MCP error: ${res.status}`);
      const rpc: JSONRPCResponse = await res.json();
      if (rpc.error) throw new Error(`MCP error: ${rpc.error.message}`);
      return rpc.result as MCPToolResult;
    } finally {
      this.abort = undefined;
    }
  }

  cancel(): void {
    this.abort?.abort();
  }
}

const sessionCache = new Map<string, MCPSession>();

function getSession(server: MCPServerConfig): MCPSession {
  let session = sessionCache.get(server.id);
  if (!session) {
    session = new MCPSession(server);
    sessionCache.set(server.id, session);
  }
  return session;
}

export const MCPClient = {
  loadServers,
  saveServers,

  addServer(config: Omit<MCPServerConfig, "id" | "enabled">): MCPServerConfig {
    const servers = loadServers();
    const server: MCPServerConfig = { ...config, id: crypto.randomUUID(), enabled: true };
    servers.push(server);
    saveServers(servers);
    return server;
  },

  removeServer(id: string): void {
    const servers = loadServers().filter((s) => s.id !== id);
    saveServers(servers);
    sessionCache.delete(id);
  },

  toggleServer(id: string, enabled: boolean): void {
    const servers = loadServers().map((s) => (s.id === id ? { ...s, enabled } : s));
    saveServers(servers);
  },

  async getTools(serverId: string): Promise<MCPTool[]> {
    const servers = loadServers();
    const server = servers.find((s) => s.id === serverId);
    if (!server || !server.enabled) return [];
    try {
      const session = getSession(server);
      await session.connect();
      return session.listTools();
    } catch (err) {
      console.warn(`MCP: Failed to get tools from ${server.name}:`, err);
      return [];
    }
  },

  async getAllEnabledTools(): Promise<{ serverId: string; serverName: string; tools: MCPTool[] }[]> {
    const servers = loadServers().filter((s) => s.enabled);
    const results: { serverId: string; serverName: string; tools: MCPTool[] }[] = [];
    for (const server of servers) {
      const tools = await this.getTools(server.id);
      if (tools.length > 0) {
        results.push({ serverId: server.id, serverName: server.name, tools });
      }
    }
    return results;
  },

  async callTool(serverId: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
    const servers = loadServers();
    const server = servers.find((s) => s.id === serverId);
    if (!server) throw new Error(`MCP server "${serverId}" not found`);
    const session = getSession(server);
    return session.callTool(toolCall);
  },
};
