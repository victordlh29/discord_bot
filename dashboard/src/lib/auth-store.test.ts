import { describe, it, expect, beforeEach } from "vitest";
import {
  removeToken,
  setAuthData,
  getIsSuperAdmin,
  setVerifyCache,
  getVerifyCache,
  getAdminGuildId,
} from "./auth-store";

beforeEach(() => {
  localStorage.clear();
});

describe("removeToken", () => {
  it("should clear all auth-related keys", () => {
    setAuthData(true, "guild-1");
    expect(getIsSuperAdmin()).toBe(true);
    expect(getAdminGuildId()).toBe("guild-1");

    removeToken();

    expect(getIsSuperAdmin()).toBe(false);
    expect(getAdminGuildId()).toBeNull();
  });
});

describe("setAuthData / getIsSuperAdmin / getAdminGuildId", () => {
  it("should store super admin status", () => {
    setAuthData(true);
    expect(getIsSuperAdmin()).toBe(true);
  });

  it("should store non-super admin status", () => {
    setAuthData(false);
    expect(getIsSuperAdmin()).toBe(false);
  });

  it("should store guild ID when provided", () => {
    setAuthData(false, "guild-456");
    expect(getAdminGuildId()).toBe("guild-456");
  });

  it("should not store guild ID when not provided", () => {
    setAuthData(false);
    expect(getAdminGuildId()).toBeNull();
  });
});

describe("verify cache", () => {
  it("should store and retrieve cached data", () => {
    const data = { user: "test", role: "admin" };
    setVerifyCache(data);
    const cached = getVerifyCache<typeof data>();
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(data);
    expect(cached!.timestamp).toBeTypeOf("number");
  });

  it("should return null when no cache exists", () => {
    expect(getVerifyCache()).toBeNull();
  });

  it("should handle corrupted cache data gracefully", () => {
    localStorage.setItem("verify_cache", "invalid-json");
    expect(getVerifyCache()).toBeNull();
  });

  it("should handle non-object cache gracefully", () => {
    localStorage.setItem("verify_cache", '"just a string"');
    const result = getVerifyCache();
    expect(result).toBe("just a string");
  });
});
