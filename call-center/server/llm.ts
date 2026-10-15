// Provider-agnostic LLM client.
//
// Talks to any OpenAI-compatible /chat/completions endpoint using plain fetch,
// so there is no vendor SDK and no cloud billing account required. Defaults to
// a local Ollama install (free, runs on your own machine). Point LLM_BASE_URL
// at LM Studio, llama.cpp server, Groq, OpenRouter, etc. to use those instead.

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const llmConfig = {
  baseUrl: (process.env.LLM_BASE_URL || 'http://localhost:11434/v1').replace(/\/+$/, ''),
  model: process.env.LLM_MODEL || 'llama3.2',
  apiKey: process.env.LLM_API_KEY || '',
  timeoutMs: process.env.LLM_TIMEOUT_MS ? parseInt(process.env.LLM_TIMEOUT_MS, 10) : 12000,
};

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (llmConfig.apiKey) h.Authorization = `Bearer ${llmConfig.apiKey}`;
  return h;
}

export async function chatCompletion(messages: ChatTurn[], temperature = 0.3): Promise<string> {
  const res = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model: llmConfig.model, messages, temperature, stream: false }),
    signal: AbortSignal.timeout(llmConfig.timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data: any = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? '').trim();
}

// Quick reachability check used by /api/health.
export async function llmReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${llmConfig.baseUrl}/models`, {
      headers: headers(),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
