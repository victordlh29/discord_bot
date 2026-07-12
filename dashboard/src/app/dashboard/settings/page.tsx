"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Save, Loader2, MessageSquare, Mic, Gauge, Ban, Bell, Trophy, Swords, Hash, Sliders, LogOut, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import { removeToken, getIsSuperAdmin } from "@/lib/auth-store";
import { logoutAllDevices } from "@/lib/api";
import { useRouter } from "next/navigation";

interface DiscordChannel {
  id: string;
  name: string;
  type: string;
  parent: string | null;
}

const channelSettings = [
  { key: "events_announce_channel", label: "Eventos", icon: <Trophy className="h-4 w-4" /> },
  { key: "missions_announce_channel", label: "Misiones", icon: <Swords className="h-4 w-4" /> },
  { key: "ranks_announce_channel", label: "Rangos", icon: <Bell className="h-4 w-4" /> },
];

interface BracketConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  minKey: string;
  maxKey: string | null;
  xpKey: string;
  defaultMin: number;
  defaultMax: number;
  defaultXp: number;
  color: string;
  borderColor: string;
}

const bracketConfigs: BracketConfig[] = [
  {
    id: "bracket1",
    name: "Mensaje Corto",
    icon: "✉️",
    description: "Mensajes breves, respuestas rápidas",
    minKey: "xp_bracket_1_min",
    maxKey: "xp_bracket_1_max",
    xpKey: "xp_rule_5_20",
    defaultMin: 5,
    defaultMax: 20,
    defaultXp: 5,
    color: "text-slate-300",
    borderColor: "border-slate-700",
  },
  {
    id: "bracket2",
    name: "Mensaje Mediano",
    icon: "📝",
    description: "Mensajes de longitud media",
    minKey: "xp_bracket_2_min",
    maxKey: "xp_bracket_2_max",
    xpKey: "xp_rule_21_50",
    defaultMin: 21,
    defaultMax: 50,
    defaultXp: 10,
    color: "text-blue-300",
    borderColor: "border-blue-800",
  },
  {
    id: "bracket3",
    name: "Mensaje Largo",
    icon: "📄",
    description: "Mensajes elaborados o con contexto",
    minKey: "xp_bracket_3_min",
    maxKey: "xp_bracket_3_max",
    xpKey: "xp_rule_51_100",
    defaultMin: 51,
    defaultMax: 100,
    defaultXp: 15,
    color: "text-purple-300",
    borderColor: "border-purple-800",
  },
  {
    id: "bracket4",
    name: "Mensaje Extenso",
    icon: "📑",
    description: "Mensajes detallados y completos",
    minKey: "xp_bracket_4_min",
    maxKey: "xp_bracket_4_max",
    xpKey: "xp_rule_101_200",
    defaultMin: 101,
    defaultMax: 200,
    defaultXp: 20,
    color: "text-amber-300",
    borderColor: "border-amber-800",
  },
  {
    id: "bracket5",
    name: "Mensaje Muy Extenso",
    icon: "📜",
    description: "Mensajes muy largos (200+ caracteres)",
    minKey: "xp_bracket_5_min",
    maxKey: null,
    xpKey: "xp_rule_200_plus",
    defaultMin: 201,
    defaultMax: 9999,
    defaultXp: 25,
    color: "text-emerald-300",
    borderColor: "border-emerald-800",
  },
];

const generalSettings = [
  {
    key: "xp_min_per_message",
    label: "XP Mínimo por Mensaje",
    hint: "Nadie puede ganar menos de esto",
    icon: <Hash className="h-4 w-4" />,
    step: "1",
  },
  {
    key: "xp_max_per_message",
    label: "XP Máximo por Mensaje",
    hint: "Nadie puede ganar más de esto (sin multiplicador)",
    icon: <Hash className="h-4 w-4" />,
    step: "1",
  },
  {
    key: "message_cooldown_seconds",
    label: "Cooldown entre Mensajes",
    hint: "Tiempo de espera en segundos",
    icon: <Sliders className="h-4 w-4" />,
    step: "1",
  },
  {
    key: "antispam_min_length",
    label: "Longitud Mínima Anti-Spam",
    hint: "Mensajes más cortos no dan XP",
    icon: <Ban className="h-4 w-4" />,
    step: "1",
  },
  {
    key: "global_multiplier",
    label: "Multiplicador Global",
    hint: "Afecta MENSAJES y VOZ (ej: 2.0 = doble XP)",
    icon: <Gauge className="h-4 w-4" />,
    step: "0.1",
  },
];

const voiceSettings = [
  {
    key: "xp_per_voice_minute",
    label: "XP por Minuto en Voz",
    hint: "XP base por cada minuto en canal de voz",
    step: "1",
  },
  {
    key: "voice_cooldown_seconds",
    label: "Cooldown de Voz",
    hint: "Segundos de espera entre sesiones de voz",
    step: "1",
  },
  {
    key: "voice_min_users",
    label: "Usuarios Mínimos en Voz",
    hint: "Mínimo de usuarios para ganar XP por voz",
    step: "1",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const { toast } = useToast();

  const handleLogoutAll = async () => {
    if (!window.confirm("¿Estás seguro? Se cerrará tu sesión en TODOS los dispositivos. Tendrás que iniciar sesión nuevamente en cada uno.")) return;
    setLoggingOutAll(true);
    const ok = await logoutAllDevices();
    if (ok) {
      toast("Sesión cerrada en todos los dispositivos");
      const wasSuper = getIsSuperAdmin();
      removeToken();
      setTimeout(() => {
        router.push(wasSuper ? "/admin/login" : "/");
      }, 1500);
    } else {
      toast("Error al cerrar sesión en todos los dispositivos", "error");
      setLoggingOutAll(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get<{ data: Record<string, string> }>("/settings"),
      api.get<{ data: DiscordChannel[] }>("/channels"),
    ])
      .then(([settingsRes, channelsRes]) => {
        setSettings(settingsRes.data);
        setChannels(channelsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast("Configuración guardada exitosamente");
    } catch {
      toast("Error al guardar configuración", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (settingKey: string, channelId: string) => {
    const current = settings[settingKey] || "";
    const list = current ? current.split(",") : [];
    const idx = list.indexOf(channelId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(channelId);
    }
    setSettings((prev) => ({ ...prev, [settingKey]: list.join(",") }));
  };

  const textChannels = channels.filter((ch) => ch.type === "text" || ch.type !== "voice");
  const voiceChannels = channels.filter((ch) => ch.type === "voice");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Configuración del Servidor</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ajustá las reglas de XP, rangos y canales del servidor
          </p>
        </div>
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: REGLAS DE XP POR MENSAJES (BRACKETS) */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Reglas de XP por Mensajes</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Cada bracket define un rango de longitud y cuánto XP da. Podés ajustar los límites y la recompensa.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {bracketConfigs.map((b) => {
            const minVal = settings[b.minKey] || String(b.defaultMin);
            const maxVal = b.maxKey ? (settings[b.maxKey] || String(b.defaultMax)) : "∞";
            const xpVal = settings[b.xpKey] || String(b.defaultXp);
            const isLast = !b.maxKey;

            return (
              <div
                key={b.id}
                className={`rounded-xl border bg-slate-900/60 p-5 backdrop-blur-sm ${b.borderColor}`}
              >
                {/* Header del bracket */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <span className="text-lg">{b.icon}</span>
                    <h3 className={`mt-1 text-base font-semibold ${b.color}`}>{b.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{b.description}</p>
                  </div>
                  {/* Badge del rango */}
                  <div className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                    {minVal} {isLast ? "+" : `– ${maxVal}`} chars
                  </div>
                </div>

                {/* Inputs del bracket */}
                <div className="space-y-3">
                  {/* Rango de caracteres */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`${b.id}-min`} className="mb-1 block text-xs text-slate-500">
                        Mín. caracteres
                      </label>
                      <input
                        id={`${b.id}-min`}
                        type="number"
                        min={1}
                        value={minVal}
                        onChange={(e) => updateSetting(b.minKey, e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    {b.maxKey && (
                      <div>
                        <label htmlFor={`${b.id}-max`} className="mb-1 block text-xs text-slate-500">
                          Máx. caracteres
                        </label>
                        <input
                          id={`${b.id}-max`}
                          type="number"
                          min={1}
                          value={maxVal}
                          onChange={(e) => updateSetting(b.maxKey!, e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* XP reward */}
                  <div>
                    <label htmlFor={`${b.id}-xp`} className="mb-1 block text-xs text-slate-500">
                      XP por mensaje
                    </label>
                    <div className="relative">
                      <input
                        id={`${b.id}-xp`}
                        type="number"
                        min={0}
                        value={xpVal}
                        onChange={(e) => updateSetting(b.xpKey, e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 pl-8 text-sm text-white focus:border-primary-500 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-yellow-400">
                        ⚡
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: LÍMITES Y MULTIPLICADOR */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-orange-400" />
          <h2 className="text-xl font-semibold text-white">Límites y Multiplicador</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Configuración general que aplica a todos los mensajes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generalSettings.map((s) => (
            <div key={s.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <label htmlFor={`gen-${s.key}`} className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                {s.icon}
                {s.label}
              </label>
              <p className="mb-2 text-xs text-slate-600">{s.hint}</p>
              <input
                id={`gen-${s.key}`}
                type="number"
                step={s.step}
                value={settings[s.key] || ""}
                onChange={(e) => updateSetting(s.key, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: XP POR VOZ */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <Mic className="h-5 w-5 text-green-400" />
          <h2 className="text-xl font-semibold text-white">XP por Voz</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Configuración del XP que se gana en canales de voz.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {voiceSettings.map((s) => (
            <div key={s.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <label htmlFor={`voice-${s.key}`} className="mb-1 block text-sm font-medium text-slate-300">
                {s.label}
              </label>
              <p className="mb-2 text-xs text-slate-600">{s.hint}</p>
              <input
                id={`voice-${s.key}`}
                type="number"
                step={s.step}
                value={settings[s.key] || ""}
                onChange={(e) => updateSetting(s.key, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: CANALES */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Canales</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Seleccioná qué canales se usan para XP y anuncios.
        </p>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Canales de texto con XP */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-1 flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Canales de Texto con XP</h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Solo en estos canales se gana XP por mensajes
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              {textChannels.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-600">No hay canales disponibles</p>
              )}
              {textChannels.map((ch) => {
                const isChecked = (settings.xp_text_channels || "").includes(ch.id);
                return (
                  <label key={ch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isChecked ? "bg-blue-500/10 text-blue-300" : "text-slate-400 hover:bg-slate-800"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleChannel("xp_text_channels", ch.id)}
                      className="rounded border-slate-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span># {ch.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Canales de voz con XP */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-1 flex items-center gap-2">
              <Mic className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white">Canales de Voz con XP</h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Solo en estos canales se gana XP por tiempo en voz
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              {voiceChannels.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-600">No hay canales de voz disponibles</p>
              )}
              {voiceChannels.map((ch) => {
                const isChecked = (settings.xp_voice_channels || "").includes(ch.id);
                return (
                  <label key={ch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isChecked ? "bg-green-500/10 text-green-300" : "text-slate-400 hover:bg-slate-800"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleChannel("xp_voice_channels", ch.id)}
                      className="rounded border-slate-600 text-green-500 focus:ring-green-500"
                    />
                    <span>🔊 {ch.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: CANALES DE ANUNCIO */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Canales de Anuncio</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Dónde se envían las notificaciones automáticas del bot.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {channelSettings.map(({ key, label, icon }) => (
            <div key={key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <label htmlFor={`ch-${key}`} className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                {icon}
                {label}
              </label>
              <p className="mb-2 text-xs text-slate-600">Canal donde se anuncian {label.toLowerCase()}</p>
              <select
                id={`ch-${key}`}
                value={settings[key] || ""}
                onChange={(e) => updateSetting(key, e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
              >
                <option value="">— Ningún canal —</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.type === "voice" ? "🔊 " : "# "}{ch.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: PALABRAS BLOQUEADAS */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-400" />
          <h2 className="text-xl font-semibold text-white">Palabras Bloqueadas</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Los mensajes que contengan estas palabras serán ignorados y no ganarán XP.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <label htmlFor="blocked-words" className="mb-2 block text-sm font-medium text-slate-300">
            Palabras bloqueadas (separadas por coma)
          </label>
          <textarea
            id="blocked-words"
            value={settings.blocked_words || ""}
            onChange={(e) => updateSetting("blocked_words", e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary-500 focus:outline-none"
            rows={3}
            placeholder="palabra1, palabra2, palabra3"
          />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/5 px-3 py-2">
            <Ban className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <p className="text-xs text-red-400">
              Si un mensaje contiene alguna de estas palabras, será completamente ignorado y no recibirá XP.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECCIÓN: SEGURIDAD */}
      {/* ============================================ */}
      <div className="mb-10">
        <div className="mb-1 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <h2 className="text-xl font-semibold text-white">Seguridad</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          Opciones de seguridad para tu cuenta.
        </p>

        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-red-300">
                <LogOut className="h-4 w-4" />
                Cerrar sesión en todos los dispositivos
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Revoca todas las sesiones activas. Vas a tener que iniciar sesión
                nuevamente en cada dispositivo o navegador donde estés conectado.
              </p>
            </div>
            <button type="button"
              onClick={handleLogoutAll}
              disabled={loggingOutAll}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-red-700 bg-red-900/30 px-5 py-2.5 text-sm font-medium text-red-300 transition-all hover:bg-red-800/50 hover:text-red-200 disabled:opacity-50"
            >
              {loggingOutAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {loggingOutAll ? "Cerrando sesiones..." : "Cerrar todas las sesiones"}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom save button */}
      <div className="sticky bottom-0 flex justify-center border-t border-slate-800 bg-slate-950/80 py-4 backdrop-blur-sm">
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-primary-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Guardando..." : "Guardar Todos los Cambios"}
        </button>
      </div>
    </div>
  );
}
