export interface Model {
  id: string;
  name: string;
  displayName?: string;
  providerId: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface ProviderHealth {
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  error?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatChunk {
  id: string;
  choices: Array<{
    delta: { content?: string; tool_calls?: any[] };
    finish_reason?: string | null;
  }>;
}

export interface Provider {
  id: string;
  name: string;
  health(): Promise<ProviderHealth>;
  listModels(): Promise<Model[]>;
  chat(request: ChatRequest): Promise<AsyncIterable<ChatChunk>>;
  // non-streaming helper
  chatSync?(request: ChatRequest): Promise<string>;
}
