import { describe, it, expect } from "vitest";
import { friendlyError, summarizeOutput } from "../src/web/helpers";

describe("friendlyError", () => {
  it("extracts message from the worker's JSON error body", () => {
    const raw = JSON.stringify({
      error: "missing_api_key",
      message: "GROQ_API_KEY is not configured.",
    });
    expect(friendlyError(raw)).toBe("GROQ_API_KEY is not configured.");
  });

  it("passes plain strings through", () => {
    expect(friendlyError("Failed to fetch")).toBe("Failed to fetch");
  });

  it("falls back on empty input", () => {
    expect(friendlyError("")).toContain("Something went wrong");
  });

  it("falls back when JSON has no message field", () => {
    expect(friendlyError('{"error":"x"}')).toBe('{"error":"x"}');
  });
});

describe("summarizeOutput", () => {
  it("flattens whitespace", () => {
    expect(summarizeOutput("a\n  b\tc")).toBe("a b c");
  });

  it("truncates long output to 120 chars", () => {
    const out = summarizeOutput("x".repeat(500));
    expect(out.length).toBe(120);
    expect(out.endsWith("...")).toBe(true);
  });

  it("stringifies non-string output", () => {
    expect(summarizeOutput({ a: 1 })).toBe('{"a":1}');
  });

  it("handles circular objects without throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(typeof summarizeOutput(circular)).toBe("string");
    expect(summarizeOutput(circular)).toBe("[object Object]");
  });
});