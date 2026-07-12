import { getIsSuperAdmin, removeToken, getAdminGuildId } from "./auth-store";

// Usar ruta relativa para que pase por el rewrite de Next.js (cookies HttpOnly se envían automáticamente)
const API_BASE = "/api";

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
  if (typeof window !== "undefined") {
    const guildId = getAdminGuildId();
    if (guildId) url.searchParams.set("guildId", guildId);
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    // Si es 401, intentar renovar el token automáticamente
    if (res.status === 401 && typeof window !== "undefined") {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Reintentar la request original una vez
        const retryRes = await fetch(url.toString(), {
          ...options,
          headers,
          credentials: "include",
        });
        if (retryRes.ok) {
          return retryRes.json();
        }
      }
      // No se pudo renovar — redirigir al login
      const wasSuper = getIsSuperAdmin();
      removeToken();
      window.location.href = wasSuper ? "/admin/login" : "/";
    }
    throw new Error(`API Error: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Cierra sesión en todos los dispositivos.
 * Llama directamente a fetch (sin pasar por request()) para evitar
 * el refresh automático en caso de 401.
 */
export async function logoutAllDevices(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/logout-all", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
