import { describe, it, expect, vi } from "vitest";
import {
  callMcpTool,
  parseSseJsonRpc,
  extractText,
  MCP_ENDPOINT,
} from "../src/worker/mcp";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("callMcpTool", () => {
  it("sends a JSON-RPC tools/call request with the right headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: "hit" }] },
      }),
    );

    const out = await callMcpTool(
      "search_cases",
      { query: "prompt injection" },
      mockFetch as unknown as typeof fetch,
    );

    expect(out).toBe("hit");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(MCP_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers["User-Agent"]).toBe("casebook-chat");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const sent = JSON.parse(init.body);
    expect(sent.method).toBe("tools/call");
    expect(sent.params).toEqual({
      name: "search_cases",
      arguments: { query: "prompt injection" },
    });
    expect(sent.jsonrpc).toBe("2.0");
  });

  it("concatenates multiple text blocks", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: {
          content: [
            { type: "text", text: "one" },
            { type: "image", data: "zzz" },
            { type: "text", text: "two" },
          ],
        },
      }),
    );
    const out = await callMcpTool("get_case", { id: "APM-0001" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("one\ntwo");
  });

  it("parses SSE-framed JSON-RPC responses", async () => {
    const sse =
      'event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"from sse"}]}}\n\n';
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(sse, { headers: { "content-type": "text/event-stream" } }),
    );
    const out = await callMcpTool("similar_failures", { description: "x" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("from sse");
  });

  it("returns a message instead of throwing on network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("boom"));
    const out = await callMcpTool("search_cases", { query: "x" }, mockFetch as unknown as typeof fetch);
    expect(out).toContain("Registry unreachable");
    expect(out).toContain("boom");
  });

  it("reports non-2xx HTTP status", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    const out = await callMcpTool("search_cases", { query: "x" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("Registry error: HTTP 502");
  });

  it("surfaces JSON-RPC errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: "2.0", id: 4, error: { code: -32601, message: "no such tool" } }),
    );
    const out = await callMcpTool("bogus", {}, mockFetch as unknown as typeof fetch);
    expect(out).toBe("Registry error: no such tool");
  });

  it("labels isError tool results", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        jsonrpc: "2.0",
        id: 5,
        result: { isError: true, content: [{ type: "text", text: "case not found" }] },
      }),
    );
    const out = await callMcpTool("get_case", { id: "NOPE" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("Tool error: case not found");
  });

  it("handles empty content gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: "2.0", id: 6, result: { content: [] } }),
    );
    const out = await callMcpTool("search_cases", { query: "zzz" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("No results found in the registry.");
  });

  it("handles invalid JSON bodies gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("<html>oops</html>", { headers: { "content-type": "application/json" } }),
    );
    const out = await callMcpTool("search_cases", { query: "x" }, mockFetch as unknown as typeof fetch);
    expect(out).toBe("Registry error: invalid response body");
  });

  it.each([
    {},
    [],
    null,
    { jsonrpc: "1.0", id: 1, result: {} },
    { jsonrpc: "2.0", id: 1, result: {}, error: { code: -1, message: "both" } },
  ])("rejects malformed JSON-RPC response shapes", async (body) => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(body));

    const out = await callMcpTool(
      "search_cases",
      { query: "x" },
      mockFetch as unknown as typeof fetch,
    );

    expect(out).toBe("Registry error: invalid response body");
  });
});

describe("parseSseJsonRpc", () => {
  it("takes the last data frame", () => {
    const sse =
      'data: {"jsonrpc":"2.0","id":1,"result":{}}\n\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"last"}]}}\n\n';
    const parsed = parseSseJsonRpc(sse);
    expect(parsed.id).toBe(2);
    expect(extractText(parsed)).toBe("last");
  });

  it("throws when no data frames exist", () => {
    expect(() => parseSseJsonRpc("event: ping\n\n")).toThrow();
  });
});

describe("extractText", () => {
  it("returns empty string when result is missing", () => {
    expect(extractText({ jsonrpc: "2.0", id: 1 })).toBe("");
  });
});
