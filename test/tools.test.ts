import { describe, expect, it, vi } from "vitest";
import { registryTools } from "../src/worker/tools";

type ParseableSchema = {
  safeParse(input: unknown): { success: boolean };
};

describe("registry tool input schemas", () => {
  const cases = [
    ["search_cases", registryTools.search_cases.inputSchema, "query"],
    ["get_case", registryTools.get_case.inputSchema, "id"],
    ["similar_failures", registryTools.similar_failures.inputSchema, "description"],
  ] as const;

  for (const [toolName, inputSchema, field] of cases) {
    it.each(["", "   "])(`${toolName} rejects blank ${field} input %j`, (value) => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const result = (inputSchema as ParseableSchema).safeParse({ [field]: value });

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  }
});
