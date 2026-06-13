import { GROQ_API_KEY, GROQ_MODEL } from "./config.js";

/**
 * Minimal Groq chat call (OpenAI-compatible). One system + one user message in,
 * the assistant's text out. Used by all three agents.
 */
export async function chat(system: string, user: string, maxTokens = 80): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY in .env");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return (data.choices?.[0]?.message?.content ?? "").trim();
}
