export type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MCPResource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type MCPServerConfig = {
  id: string;
  name: string;
  transport: "sse" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
};

export type MCPToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type MCPToolResult = {
  content: { type: "text" | "image" | "resource"; text?: string; data?: string; mimeType?: string }[];
  isError?: boolean;
};

export type MCPError = {
  code: number;
  message: string;
};

// JSON-RPC 2.0 types
export type JSONRPCRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

export type JSONRPCResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
};

// MCP protocol methods
export const MCP_METHODS = {
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
  RESOURCES_LIST: "resources/list",
  RESOURCES_READ: "resources/read",
  PROMPTS_LIST: "prompts/list",
  INITIALIZE: "initialize",
} as const;
