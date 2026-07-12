"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { GuildProvider, useGuild } from "@/lib/guild";
import { Loader2, AlertTriangle } from "lucide-react";
import { setAuthData, getVerifyCache, setVerifyCache, removeToken, getIsSuperAdmin } from "@/lib/auth-store";

const VERIFY_CACHE_TTL = 5 * 60 * 1000;

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { guildId } = useGuild();

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <main key={guildId || "no-guild"} className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;

    // No más token en localStorage — la cookie HttpOnly se envía automáticamente

    const cached = getVerifyCache<{ isSuperAdmin: boolean; adminGuildId: string }>();
    if (cached && Date.now() - cached.timestamp < VERIFY_CACHE_TTL) {
      setAuthData(cached.data.isSuperAdmin, cached.data.adminGuildId);
      verifiedRef.current = true;
      setAuthenticated(true);
      setLoading(false);
      return;
    }

    fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include", // envía la cookie HttpOnly automáticamente
    })
      .then((res) => {
        if (res.status === 429) {
          setRateLimited(true);
          setLoading(false);
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        const data = json.data;
        setVerifyCache({ isSuperAdmin: data?.isSuperAdmin ?? false, adminGuildId: data?.adminGuildId ?? "" });
        setAuthData(data?.isSuperAdmin ?? false, data?.adminGuildId);
        verifiedRef.current = true;
        setAuthenticated(true);
        setLoading(false);
      })
      .catch(async () => {
        // Intentar renovar el token antes de redirigir al login
        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          if (refreshRes.ok) {
            // Reintentar verify
            const retryRes = await fetch("/api/auth/verify", {
              method: "POST",
              credentials: "include",
            });
            if (retryRes.ok) {
              const json = await retryRes.json();
              const data = json.data;
              setVerifyCache({ isSuperAdmin: data?.isSuperAdmin ?? false, adminGuildId: data?.adminGuildId ?? "" });
              setAuthData(data?.isSuperAdmin ?? false, data?.adminGuildId);
              verifiedRef.current = true;
              setAuthenticated(true);
              setLoading(false);
              return;
            }
          }
        } catch {
          // refresh falló, redirigir
        }
        const wasSuper = getIsSuperAdmin();
        removeToken();
        router.push(wasSuper ? "/admin/login" : "/");
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (rateLimited) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">Demasiadas solicitudes</h2>
        <p className="max-w-md text-slate-400">
          El servidor está recibiendo muchas peticiones. Esperá un minuto y
          recargá la página para intentar de nuevo.
        </p>
        <button type="button"
          onClick={() => {
            removeToken();
            window.location.reload();
          }}
          className="rounded-lg bg-primary-600 px-6 py-2 font-medium text-white hover:bg-primary-500"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <GuildProvider>
      <ToastProvider>
        <DashboardContent>{children}</DashboardContent>
      </ToastProvider>
    </GuildProvider>
  );
}
