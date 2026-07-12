import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FetchEventSource } from "./sse";

const mockReader = {
  read: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: {
      getReader: () => mockReader,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("FetchEventSource", () => {
  it("should connect with Bearer token", () => {
    const source = new FetchEventSource("http://localhost:4000/events", "test-token", {
      onMessage: () => {/* noop */},
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/events",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      })
    );

    source.close();
  });

  it("should close cleanly", () => {
    const source = new FetchEventSource("http://localhost:4000/events", "token", {
      onMessage: () => {/* noop */},
    });

    source.close();
    // closed flag set, timers cleared, controller aborted
    expect(source["closed"]).toBe(true);
  });

  it("should handle non-ok response and schedule retry", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    });

    const source = new FetchEventSource("http://localhost:4000/events", "token", {
      onMessage: () => {/* noop */},
    });

    // Wait for the async connect to fail and scheduleRetry to be called
    await vi.advanceTimersByTimeAsync(0);

    expect((source as unknown as { closed: boolean }).closed).toBe(false);
    source.close();
  });

  it("should close cleanly on user request", async () => {
    const source = new FetchEventSource("http://localhost:4000/events", "token", {
      onMessage: () => {/* noop */},
    });

    // Let the connection start
    await vi.advanceTimersByTimeAsync(0);
    source.close();

    expect((source as unknown as { closed: boolean }).closed).toBe(true);
  });
});
