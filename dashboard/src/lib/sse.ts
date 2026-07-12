type SSECallback = (data: unknown) => void;

const MAX_RETRIES = 10;
const RETRY_DELAY = 10_000;

export class FetchEventSource {
  private controller: AbortController | null = null;
  private onMessage: SSECallback;
  private onError: (() => void) | null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private retries = 0;

  constructor(
    private url: string,
    private token: string,
    callbacks: { onMessage: SSECallback; onError?: () => void }
  ) {
    this.onMessage = callbacks.onMessage;
    this.onError = callbacks.onError || null;
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    this.controller = new AbortController();

    try {
      const headers: Record<string, string> = {};
      // Solo enviar Authorization si hay un token (para compatibilidad con clientes antiguos)
      // Si no hay token, la cookie HttpOnly se envía automáticamente
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const response = await fetch(this.url, {
        headers,
        credentials: "include", // Enviar cookie HttpOnly automáticamente
        signal: this.controller.signal,
      });

      if (!response.ok || !response.body) {
        this.scheduleRetry();
        return;
      }

      // Conexión exitosa — reiniciar contador de reintentos
      this.retries = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Stream closed by server — reconnect
          this.scheduleRetry();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              this.onMessage(data);
            } catch {
              console.warn("SSE: datos mal formados recibidos");
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.closed) return;
    this.retries++;
    if (this.retries > MAX_RETRIES) {
      console.warn(`SSE: máximos reintentos (${MAX_RETRIES}) alcanzados para ${this.url}`);
      this.closed = true;
      return;
    }
    this.controller?.abort();
    this.onError?.();
    const delay = Math.min(RETRY_DELAY * Math.pow(1.5, this.retries - 1), 60_000);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.controller?.abort();
    this.controller = null;
  }
}
