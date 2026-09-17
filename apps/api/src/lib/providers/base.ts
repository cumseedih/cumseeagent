import type { Provider, ProviderHealth, ChatRequest, ChatChunk, Model } from "./types.js";

export abstract class BaseProvider implements Provider {
  abstract id: string;
  abstract name: string;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private cooldownUntil: number | null = null;
  private readonly maxFailures = 3;
  private readonly cooldownMs = 5 * 60 * 1000; // 5 minutes

  protected isInCooldown(): boolean {
    if (!this.cooldownUntil) return false;
    if (Date.now() > this.cooldownUntil) {
      this.cooldownUntil = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  protected recordSuccess() {
    this.consecutiveFailures = 0;
    this.cooldownUntil = null;
  }

  protected recordFailure(error: any) {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.cooldownUntil = Date.now() + this.cooldownMs;
    }
    // If error is 429 or quota, immediately cooldown
    const msg = String(error?.message || error);
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
      this.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  protected async withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Provider timeout after ${ms}ms`)), ms)),
    ]);
  }

  protected async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        if (this.isInCooldown()) {
          throw new Error(`Provider ${this.id} is in cooldown until ${new Date(this.cooldownUntil!).toISOString()}`);
        }
        const result = await this.withTimeout(fn());
        this.recordSuccess();
        return result;
      } catch (e: any) {
        lastError = e;
        this.recordFailure(e);
        if (i === retries) break;
        // Exponential backoff
        const delay = 500 * Math.pow(2, i) + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
        // Don't retry on 429/quota/cooldown
        const m = String(e.message);
        if (m.includes("429") || m.includes("quota") || m.includes("cooldown")) break;
      }
    }
    throw lastError;
  }

  abstract health(): Promise<ProviderHealth>;
  abstract listModels(): Promise<Model[]>;
  abstract chat(request: ChatRequest): Promise<AsyncIterable<ChatChunk>>;
}
