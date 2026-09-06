import { Hono } from "hono";
import { createGroq } from "@ai-sdk/groq";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { registryTools, SYSTEM_PROMPT } from "./tools";

type Env = {
  GROQ_API_KEY?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.post("/api/chat", async (c) => {
  if (!c.env.GROQ_API_KEY) {
    return c.json(
      {
        error: "missing_api_key",
        message:
          "GROQ_API_KEY is not configured. Add it to .dev.vars for local dev or set it as a Worker secret (wrangler secret put GROQ_API_KEY).",
      },
      503,
    );
  }

  let messages: UIMessage[];
  try {
    const body = await c.req.json<{ messages?: UIMessage[] }>();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("empty");
    }
    messages = body.messages;
  } catch {
    return c.json(
      { error: "bad_request", message: "Expected { messages: UIMessage[] }." },
      400,
    );
  }

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages);
  } catch {
    return c.json(
      { error: "bad_request", message: "Expected { messages: UIMessage[] }." },
      400,
    );
  }

  const groq = createGroq({ apiKey: c.env.GROQ_API_KEY });

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: registryTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
});

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "not_found", message: "No such endpoint." }, 404);
  }
  return c.text("Not found", 404);
});

export default app;
