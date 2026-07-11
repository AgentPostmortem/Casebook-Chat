import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import { MarkdownLite } from "./markdown";
import { friendlyError, summarizeOutput } from "./helpers";

const STARTERS = [
  "Why do refund agents get prompt-injected?",
  "Find failures similar to: my agent deleted a database",
  "What goes wrong when agents run shell commands?",
  "Show me a case about infinite loops",
];

const TOOL_LABELS: Record<string, string> = {
  "tool-search_cases": "search_cases",
  "tool-get_case": "get_case",
  "tool-similar_failures": "similar_failures",
};

type AnyPart = UIMessagePart<UIDataTypes, UITools>;

function ToolChip({ part }: { part: AnyPart & { type: string } }) {
  const [open, setOpen] = useState(false);
  const p = part as unknown as {
    type: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
  const name = TOOL_LABELS[p.type] ?? p.type.replace(/^tool-/, "");
  const running = p.state === "input-streaming" || p.state === "input-available";
  const failed = p.state === "output-error";

  return (
    <div className={`tool-chip ${running ? "running" : ""} ${failed ? "failed" : ""}`}>
      <button
        type="button"
        className="tool-chip-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tool-dot" aria-hidden="true" />
        <span className="tool-name">{name}</span>
        <span className="tool-status">
          {running ? "running" : failed ? "error" : "done"}
        </span>
        <span className="tool-caret">{open ? "▴" : "▾"}</span>
      </button>
      {!open && p.state === "output-available" && (
        <div className="tool-summary">{summarizeOutput(p.output)}</div>
      )}
      {open && (
        <div className="tool-detail">
          <div className="tool-section">
            <span className="tool-label">args</span>
            <pre>{JSON.stringify(p.input ?? {}, null, 2)}</pre>
          </div>
          {p.state === "output-available" && (
            <div className="tool-section">
              <span className="tool-label">result</span>
              <pre>
                {typeof p.output === "string"
                  ? p.output
                  : JSON.stringify(p.output, null, 2)}
              </pre>
            </div>
          )}
          {failed && (
            <div className="tool-section">
              <span className="tool-label">error</span>
              <pre>{p.errorText ?? "unknown error"}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`msg ${isUser ? "user" : "assistant"}`}>
      <div className="msg-role">{isUser ? "You" : "Casebook"}</div>
      <div className="msg-body">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <MarkdownLite key={i} text={part.text} />;
          }
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return <ToolChip key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default function App() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Casebook Chat</span>
        </div>
        <span className="tagline">AI-agent failure investigation, grounded in the registry</span>
      </header>

      <main className="stream" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            <h1>Investigate agent failures</h1>
            <p>
              Ask about documented AI-agent incidents. Answers are grounded in
              live case files from the AgentPostmortem registry and cite case
              IDs.
            </p>
            <div className="starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="starter" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {status === "submitted" && (
          <div className="msg assistant">
            <div className="msg-role">Casebook</div>
            <div className="msg-body">
              <span className="thinking">Investigating...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {friendlyError(error.message)}
          </div>
        )}
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe an incident or ask about a failure mode..."
          aria-label="Message"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>

      <footer className="footnote">
        Powered by Groq (free tier) and the live registry at
        {" "}
        <a href="https://mcp.agentpostmortem.com" rel="noreferrer">mcp.agentpostmortem.com</a>
      </footer>
    </div>
  );
}
