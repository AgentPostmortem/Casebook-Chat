import { describe, expect, it } from "vitest";
import app from "../src/worker";

describe("POST /api/chat", () => {
  it("returns a structured 400 for malformed message parts", async () => {
    const response = await app.request(
      "/api/chat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              parts: [{ value: "bad" }],
            },
          ],
        }),
      },
      { GROQ_API_KEY: "test-key" },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "bad_request",
      message: "Expected { messages: UIMessage[] }.",
    });
  });
});
