import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";

// Mock localStorage for auth-store
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorageMock.clear();
  // Default mock: successful response
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ status: "success", data: [] }),
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Helper to extract fetch call args as plain object
function getLastFetchCall() {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  if (calls.length === 0) return { url: "", method: "", headers: {}, body: undefined };
  const lastCall = calls[calls.length - 1];
  const [url, options] = lastCall;
  return {
    url: typeof url === "string" ? url : (url as URL).toString(),
    method: (options as RequestInit).method || "GET",
    headers: (options as RequestInit).headers as Record<string, string>,
    body: (options as RequestInit).body as string | undefined,
  };
}

describe("api.get", () => {
  it("should make a GET request with correct URL", async () => {
    await api.get("/users");
    const call = getLastFetchCall();
    expect(call.url).toContain("/api/users");
    expect(call.method).toBe("GET");
  });

  it("should NOT include Authorization header (token is in HttpOnly cookie)", async () => {
    await api.get("/users");
    const call = getLastFetchCall();
    expect(call.headers["Authorization"]).toBeUndefined();
  });

  it("should include Content-Type header", async () => {
    await api.get("/users");
    const call = getLastFetchCall();
    expect(call.headers["Content-Type"]).toBe("application/json");
  });

  it("should throw on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Not Found",
      status: 404,
      json: () => Promise.resolve({}),
    });
    await expect(api.get("/users")).rejects.toThrow("API Error: Not Found");
  });
});

describe("api.post", () => {
  it("should make a POST request with JSON body", async () => {
    const data = { name: "Test", value: 42 };
    await api.post("/users", data);
    const call = getLastFetchCall();
    expect(call.method).toBe("POST");
    expect(call.body).toBe(JSON.stringify(data));
    expect(call.headers["Content-Type"]).toBe("application/json");
  });

  it("should make a POST request without body", async () => {
    await api.post("/users");
    const call = getLastFetchCall();
    expect(call.method).toBe("POST");
    expect(call.body).toBeUndefined();
  });

  it("should return parsed response data", async () => {
    const responseData = { status: "success", data: { id: "u1" } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });
    const result = await api.post("/users", { name: "Test" });
    expect(result).toEqual(responseData);
  });
});

describe("api.put", () => {
  it("should make a PUT request with JSON body", async () => {
    const data = { name: "Updated" };
    await api.put("/users/1", data);
    const call = getLastFetchCall();
    expect(call.method).toBe("PUT");
    expect(call.body).toBe(JSON.stringify(data));
  });
});

describe("api.delete", () => {
  it("should make a DELETE request", async () => {
    await api.delete("/users/1");
    const call = getLastFetchCall();
    expect(call.method).toBe("DELETE");
  });
});
