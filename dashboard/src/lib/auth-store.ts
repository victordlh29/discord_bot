const SUPER_KEY = "isSuperAdmin";
const GUILD_KEY = "adminGuildId";
const CACHE_KEY = "verify_cache";

export function removeToken(): void {
  localStorage.removeItem(SUPER_KEY);
  localStorage.removeItem(GUILD_KEY);
  localStorage.removeItem(CACHE_KEY);
}

export function setAuthData(isSuperAdmin: boolean, adminGuildId?: string): void {
  localStorage.setItem(SUPER_KEY, String(isSuperAdmin));
  if (adminGuildId) localStorage.setItem(GUILD_KEY, adminGuildId);
}

export function getIsSuperAdmin(): boolean {
  return localStorage.getItem(SUPER_KEY) === "true";
}

export function setVerifyCache(data: unknown): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
}

export function getVerifyCache<T>(): { timestamp: number; data: T } | null {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function getAdminGuildId(): string | null {
  return localStorage.getItem(GUILD_KEY);
}
