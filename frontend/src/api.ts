import type { QueryResponse } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function askQuestion(question: string): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body.error === "string"
        ? body.error
        : "Something went wrong reaching the server.";
    throw new ApiError(message, res.status);
  }

  return body as QueryResponse;
}
