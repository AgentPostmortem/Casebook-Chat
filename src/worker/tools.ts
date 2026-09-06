import { tool } from "ai";
import { z } from "zod";
import { callMcpTool } from "./mcp";

const nonBlankInput = (description: string) =>
  z.string().trim().min(1, "Input must not be blank").describe(description);

/**
 * AI SDK tool definitions, each backed by a JSON-RPC tools/call to the
 * live Casebook MCP registry at mcp.agentpostmortem.com.
 */
export const registryTools = {
  search_cases: tool({
    description:
      "Full-text search over documented AI-agent failure cases. Returns case summaries with case IDs, ranked by relevance.",
    inputSchema: z.object({
      query: nonBlankInput("Search terms, e.g. 'refund prompt injection'"),
    }),
    execute: async ({ query }) => callMcpTool("search_cases", { query }),
  }),
  get_case: tool({
    description:
      "Fetch the full detail of one failure case by its case number (e.g. 'APM-0048'): outcome, verified facts, unknowns, lessons.",
    inputSchema: z.object({
      id: nonBlankInput("Case number, e.g. 'APM-0048'"),
    }),
    execute: async ({ id }) => callMcpTool("get_case", { id }),
  }),
  similar_failures: tool({
    description:
      "Given a plain-language description of an incident, find the most similar documented agent failures and how they were fixed.",
    inputSchema: z.object({
      description: nonBlankInput("Plain-language description of the incident"),
    }),
    execute: async ({ description }) =>
      callMcpTool("similar_failures", { description }),
  }),
};

export const SYSTEM_PROMPT = `You are the Casebook investigator, an incident-investigation assistant for AI-agent failures. You work from the AgentPostmortem registry, a public casebook of documented agent incidents.

Rules:
- ALWAYS ground your answers in registry cases. Use the tools on every question: search_cases to find relevant cases, get_case to pull full detail, similar_failures to match a described incident against the casebook.
- ALWAYS cite case IDs (e.g. APM-0048) when you draw on a case. Never invent case IDs or facts that the tools did not return.
- If the registry has nothing relevant, say so plainly and answer from general knowledge, clearly labeled as such.
- Be concise and structured: what happened, why, and what fixed it or would fix it.
- Distinguish verified facts from speculation, as the case files do.`;
