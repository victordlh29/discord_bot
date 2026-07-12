"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { setAuthData } from "@/lib/auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/auth-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include", // Necesario para recibir la cookie
      });

      const json = await res.json();

      if (!res.ok || !json.data?.token) {
        setError(json.message || "Error al iniciar sesión");
        return;
      }

      // El servidor ya seteó la cookie HttpOnly 'token'
      // Solo guardamos metadatos no sensibles en localStorage
      setAuthData(true, json.data.adminGuildId);
      router.push("/dashboard");
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="mb-8 flex items-center gap-4">
        <Shield className="h-12 w-12 text-primary-400" />
        <h1 className="text-4xl font-bold text-white">STAN PLAYA SEGUNDO</h1>
      </div>
      <p className="mb-8 text-lg text-slate-400">Acceso de Administrador</p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-6 py-3 text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Usuario"
          aria-label="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          aria-label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-8 py-3 font-semibold text-white transition-all hover:bg-primary-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ingresar"}
        </button>
      </form>

      <Link
        href="/"
        className="mt-6 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>
    </div>
  );
}
