# Casebook Chat

A streaming AI chat UI that investigates AI-agent failures. Ask about an incident and the assistant searches the live [AgentPostmortem](https://mcp.agentpostmortem.com) case registry, pulls full case files, and answers with cited case IDs. Tool calls render inline as collapsible chips while the response streams.

Part of a three-project portfolio, alongside [RelayG](https://github.com/AgentPostmortem/relayg) and [hire.agentpostmortem.com](https://hire.agentpostmortem.com).

## Architecture

```
Browser (Vite + React, @ai-sdk/react useChat)
   |  POST /api/chat (UI message stream)
   v
Cloudflare Worker (Hono + Vercel AI SDK streamText)
   |                         |
   v                         v
Groq (llama-3.3-70b)     MCP registry (JSON-RPC tools/call)
                         https://mcp.agentpostmortem.com/mcp
```

One Cloudflare Worker serves both the static UI (Workers assets) and the API. `POST /api/chat` runs `streamText` against Groq with three tools defined via the AI SDK `tool()` helper and zod schemas:

- `search_cases(query)` - full-text search over failure case files
- `get_case(id)` - full detail of one case (facts, unknowns, lessons)
- `similar_failures(description)` - match a described incident against the casebook

Each tool is a `fetch` to the MCP server using JSON-RPC `tools/call`; the client validates that a tool name is present before sending a request. Multi-step tool chains are allowed (up to 5 steps), and the result streams back with `toUIMessageStreamResponse()`, so the UI sees tool inputs and outputs as typed message parts.

## Quickstart

```bash
npm install
cp .dev.vars.example .dev.vars   # add your GROQ_API_KEY (free at console.groq.com)
npm run build                    # build the UI into dist/client
npm run dev                      # wrangler dev on http://localhost:8787
```

Without a key, `/api/chat` returns a friendly JSON error that the UI displays; the shell still loads.

Other commands:

```bash
npm run check    # tsc --noEmit for web and worker
npm test         # vitest (JSON-RPC client + UI helpers)
npm run deploy   # build + wrangler deploy (set GROQ_API_KEY as a Worker secret)
```

## Honest notes

- Inference runs on the Groq free tier, so rate limits and occasional slowdowns apply.
- The registry data is community-documented and comes straight from the live MCP server; the assistant is instructed to cite case IDs and to say so when the casebook has nothing relevant.

## Links

- Registry MCP server: https://mcp.agentpostmortem.com
- Hiring page: https://hire.agentpostmortem.com
- RelayG: https://github.com/AgentPostmortem/relayg
