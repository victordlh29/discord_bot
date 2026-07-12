"use client";

import { useState, useCallback } from "react";
import { Copy, Trash2, Search, Image, Link2, AlertTriangle } from "lucide-react";
import GifPreviewCard from "@/components/GifPreviewCard";
import { classifyUrl, type GifEntry } from "@/lib/gif-utils";

function StatBadge({ count, label, variant }: { count: number; label: string; variant: "total" | "direct" | "page" | "unknown" }) {
  if (count === 0 && variant !== "total") return null;
  const colors = {
    total: "bg-slate-800 text-slate-400",
    direct: "bg-emerald-500/10 text-emerald-400",
    page: "bg-amber-500/10 text-amber-400",
    unknown: "bg-slate-500/10 text-slate-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${colors[variant]}`}>
      <span className="font-bold text-sm">{count}</span> {label}
    </span>
  );
}

// ── Toast ──

function useCopyToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const ToastComponent = toast ? (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-5 py-3 text-sm shadow-2xl transition-all duration-300 ${
        toast.type === "success"
          ? "border-emerald-800 bg-emerald-950 text-emerald-200"
          : "border-red-800 bg-red-950 text-red-200"
      }`}
    >
      {toast.message}
    </div>
  ) : null;

  return { show, ToastComponent };
}

// ── Main Page ──

export default function GifResolverPage() {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<GifEntry[] | null>(null);
  const [copied, setCopied] = useState(false);
  const { show: showToast, ToastComponent } = useCopyToast();

  const analyze = useCallback(() => {
    if (!input.trim()) {
      showToast("❌ Pega al menos una URL", "error");
      return;
    }
    const lines = input.split("\n").filter(s => s.trim());
    const result = lines.map(line => classifyUrl(line.trim())).filter(Boolean) as GifEntry[];
    setEntries(result);

    const direct = result.filter(e => e.type === "direct").length;
    const pages = result.filter(e => e.type === "page").length;
    showToast(`✅ ${result.length} URL${result.length !== 1 ? "s" : ""} analizada${result.length !== 1 ? "s" : ""}: ${direct} directa${direct !== 1 ? "s" : ""}, ${pages} página${pages !== 1 ? "s" : ""}`);
  }, [input, showToast]);

  const copyUrls = useCallback(() => {
    if (!entries) return;
    const valid = entries.filter(e => e.type !== "invalid").map(e => e.url).join("\n");
    if (!valid) {
      showToast("❌ No hay URLs válidas para copiar", "error");
      return;
    }
    navigator.clipboard.writeText(valid).then(() => {
      showToast("📋 URLs copiadas — Pégalas en Dashboard → Rangos");
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      showToast("❌ Error al copiar", "error");
    });
  }, [entries, showToast]);

  const clearAll = useCallback(() => {
    setInput("");
    setEntries(null);
    setCopied(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      analyze();
    }
  }, [analyze]);

  // Stats
  const direct = entries?.filter(e => e.type === "direct") ?? [];
  const pages = entries?.filter(e => e.type === "page") ?? [];
  const unknown = entries?.filter(e => e.type === "unknown" || e.type === "invalid") ?? [];
  const hasResults = entries !== null && entries.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">🎬 Resolvedor de GIFs</h1>
        <p className="mt-1 text-slate-400">
          Pega URLs de GIFs, detecta automáticamente cuáles son directos y prepáralos para los rangos
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">1</span>
            Pega URLs
          </span>
          <span className="text-slate-600 text-lg leading-8">→</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">2</span>
            Analiza
          </span>
          <span className="text-slate-600 text-lg leading-8">→</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">3</span>
            Abre páginas web 🔗
          </span>
          <span className="text-slate-600 text-lg leading-8">→</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">4</span>
            Copia al dashboard 🎯
          </span>
        </div>
      </div>

      {/* Input section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <label className="mb-2 block text-sm font-medium text-white">
          URLs de GIFs <span className="text-slate-500 font-normal">(una por línea)</span>
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://media1.giphy.com/media/.../giphy.gif&#10;https://tenor.com/es/view/leon-re4-...&#10;https://media.discordapp.net/attachments/.../gif"
          rows={5}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={analyze}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-500 hover:-translate-y-0.5"
          >
            <Search className="h-4 w-4" />
            Analizar URLs
          </button>
          <button
            type="button"
            onClick={copyUrls}
            disabled={!hasResults}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/50 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-900/50 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Copy className="h-4 w-4" />
            {copied ? "✅ Copiado" : "Copiar URLs al dashboard"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:-translate-y-0.5"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          💡 También puedes presionar <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">Ctrl+Enter</kbd> para analizar
        </p>
      </div>

      {/* Stats */}
      {hasResults && (
        <div className="mt-5 flex flex-wrap gap-2 rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
          <StatBadge count={entries.length} label="total" variant="total" />
          <StatBadge count={direct.length} label="GIFs directos" variant="direct" />
          <StatBadge count={pages.length} label="páginas web" variant="page" />
          <StatBadge count={unknown.length} label="desconocidos" variant="unknown" />
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Resultados</h2>
            <span className="text-sm text-slate-500">{entries.length} URL{entries.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry, i) => {
              const borderColor =
                entry.type === "direct" ? "border-emerald-700/40 hover:border-emerald-600" :
                entry.type === "page" ? "border-amber-700/40 hover:border-amber-600" :
                entry.type === "invalid" ? "border-red-700/40" :
                "border-slate-700/50";

              return (
                <div key={i} className={`rounded-xl border bg-slate-900/40 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${borderColor}`}>
                  {/* Preview */}
                  <div className="aspect-video bg-slate-950 flex items-center justify-center min-h-[120px]">
                    {entry.type === "direct" && (
                      <GifPreviewCard url={entry.url} index={i} />
                    )}
                    {entry.type === "page" && (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <Link2 className="h-8 w-8 text-amber-400 mb-2" />
                        <span className="text-xs text-amber-400/80">Página web — No es un GIF directo</span>
                      </div>
                    )}
                    {entry.type === "unknown" && (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <AlertTriangle className="h-8 w-8 text-slate-500 mb-2" />
                        <span className="text-xs text-slate-500">Tipo de URL no detectado</span>
                      </div>
                    )}
                    {entry.type === "invalid" && (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
                        <span className="text-xs text-red-400">URL inválida</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        entry.type === "direct" ? "bg-emerald-500/15 text-emerald-400" :
                        entry.type === "page" ? "bg-amber-500/15 text-amber-400" :
                        entry.type === "invalid" ? "bg-red-500/15 text-red-400" :
                        "bg-slate-500/15 text-slate-400"
                      }`}>
                        {entry.icon} {entry.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 break-all leading-relaxed mb-3">{entry.url}</p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700"
                      >
                        {entry.type === "page" ? "🔍 Abrir página" : "🔗 Abrir"}
                      </a>
                      {entry.type !== "invalid" && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(entry.url).then(() => {
                              showToast("✅ URL copiada");
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-primary-700/30 bg-primary-950/30 px-2.5 py-1.5 text-xs text-primary-300 transition-colors hover:bg-primary-900/30"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar URL
                        </button>
                      )}
                    </div>

                    {entry.type === "page" && (
                      <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
                        💡 Abre el enlace, busca la URL real del GIF (suele estar al hacer clic derecho → "Copiar dirección de imagen") y pégala aquí
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasResults && entries !== null && entries.length === 0 && (
        <div className="mt-8 text-center py-12 text-slate-500">
          <Image className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p>No se encontraron URLs. Pega algunos links y presiona "Analizar URLs".</p>
        </div>
      )}

      {entries === null && (
        <div className="mt-8 text-center py-12 text-slate-600">
          <Image className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Pega las URLs de tus GIFs y presiona "Analizar URLs"</p>
          <p className="text-xs mt-2 text-slate-700">Soporta Giphy, Tenor, MakeAGIF, Discord CDN y cualquier GIF directo</p>
        </div>
      )}

      {ToastComponent}
    </div>
  );
}
