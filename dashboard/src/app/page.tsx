"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function HomePage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar si ya hay sesión activa vía cookie HttpOnly
    fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          window.location.href = "/dashboard";
        }
      })
      .catch(() => {
        // No hay sesión activa, mostrar login
      });

    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      window.history.replaceState({}, "", "/");
      setError(decodeURIComponent(errorParam));
    }
  }, []);

  const handleDiscordLogin = useCallback(() => {
    const state = generateState();
    document.cookie = `oauth_state=${state}; path=/; max-age=600; SameSite=Lax`;
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!,
      response_type: "code",
      scope: "identify guilds",
      state,
    });
    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="mb-8 flex items-center gap-4">
        <Shield className="h-12 w-12 text-primary-400" />
        <h1 className="text-4xl font-bold text-white">STAN PLAYA SEGUNDO</h1>
      </div>
      <p className="mb-8 text-lg text-slate-400">Sistema de Gamificación para Discord</p>
      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-6 py-3 text-red-400">
          {error}
        </div>
      )}
      <button type="button"
        onClick={handleDiscordLogin}
        className="rounded-lg bg-[#5865F2] px-8 py-3 font-semibold text-white transition-all hover:bg-[#4752C4]"
      >
        Iniciar Sesión con Discord
      </button>
      <Link
        href="/admin/login"
        className="mt-4 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        Acceso de Administrador
      </Link>
    </div>
  );
}
