/** Pure helpers for the chat UI. Kept dependency-free so they are easy to test. */

/** Turn a raised transport error into a human-readable message. */
export function friendlyError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    // not JSON, fall through
  }
  return raw || "Something went wrong. Please try again.";
}

/** One-line summary of a tool result for the collapsed chip. */
export function summarizeOutput(output: unknown): string {
  const text =
    typeof output === "string" ? output : JSON.stringify(output ?? "");
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? flat.slice(0, 117) + "..." : flat;
}
