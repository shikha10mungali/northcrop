import { useState, type FormEvent } from "react";
import { ApiError, askQuestion } from "../api";
import type { ChatMessage } from "../types";
import { ResultRenderer } from "./ResultRenderer";

const SAMPLE_QUESTIONS = [
  "What is the total balance by branch?",
  "How many total customers do we have?",
  "Show me the monthly transaction trend",
  "Recent transactions",
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", question: trimmed },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await askQuestion(trimmed);
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", response },
      ]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server. Is the backend running?";
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", error: message },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>Ask a question about the bank's customers, accounts, or transactions.</p>
            <div className="sample-chips">
              {SAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            {message.role === "user" && (
              <p className="question">{message.question}</p>
            )}
            {message.response && <ResultRenderer response={message.response} />}
            {message.error && <p className="error-message">{message.error}</p>}
          </div>
        ))}

        {isLoading && <p className="loading">Thinking…</p>}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question, e.g. total balance by branch"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || input.trim().length === 0}>
          Send
        </button>
      </form>
    </div>
  );
}
