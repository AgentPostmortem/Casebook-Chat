/**
 * Minimal JSON-RPC client for the Casebook MCP server.
 * Talks to https://mcp.agentpostmortem.com/mcp via tools/call.
 */

export const MCP_ENDPOINT = "https://mcp.agentpostmortem.com/mcp";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

let rpcId = 0;

/**
 * Call a tool on the MCP server via JSON-RPC tools/call.
 * Returns the concatenated text content, or a descriptive error string
 * (never throws, so the model can recover gracefully).
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const toolName = name.trim();
  if (!toolName) {
    return "Tool error: tool name is required";
  }

  const body = {
    jsonrpc: "2.0" as const,
    id: ++rpcId,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  let res: Response;
  try {
    res = await fetchImpl(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "User-Agent": "casebook-chat",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return `Registry unreachable: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (!res.ok) {
    return `Registry error: HTTP ${res.status}`;
  }

  const contentType = res.headers.get("content-type") ?? "";
  let payload: JsonRpcResponse;
  try {
    if (contentType.includes("text/event-stream")) {
      payload = parseSseJsonRpc(await res.text());
    } else {
      payload = (await res.json()) as JsonRpcResponse;
    }
  } catch {
    return "Registry error: invalid response body";
  }

  if (!isJsonRpcResponse(payload)) {
    return "Registry error: invalid response body";
  }

  if (payload.error) {
    return `Registry error: ${payload.error.message}`;
  }

  const text = extractText(payload);
  if (payload.result?.isError) {
    return `Tool error: ${text || "unknown tool failure"}`;
  }
  return text || "No results found in the registry.";
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const validId =
    payload.id === null || typeof payload.id === "number" || typeof payload.id === "string";
  const hasResult = Object.hasOwn(payload, "result");
  const hasError = Object.hasOwn(payload, "error");
  if (payload.jsonrpc !== "2.0" || !validId || hasResult === hasError) return false;

  if (hasError) {
    const error = payload.error;
    return (
      typeof error === "object" &&
      error !== null &&
      !Array.isArray(error) &&
      typeof (error as Record<string, unknown>).code === "number" &&
      typeof (error as Record<string, unknown>).message === "string"
    );
  }

  return typeof payload.result === "object" && payload.result !== null && !Array.isArray(payload.result);
}

/** Parse the last JSON-RPC message out of an SSE response body. */
export function parseSseJsonRpc(sse: string): JsonRpcResponse {
  const dataLines = sse
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (dataLines.length === 0) {
    throw new Error("no data frames in SSE response");
  }
  return JSON.parse(dataLines[dataLines.length - 1]) as JsonRpcResponse;
}

/** Concatenate text blocks from an MCP tool result. */
export function extractText(payload: JsonRpcResponse): string {
  const blocks = payload.result?.content ?? [];
  return blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
