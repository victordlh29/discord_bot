"use client";

import { useEffect, useState, useCallback, useReducer, useMemo } from "react";
import { api } from "@/lib/api";
import { FetchEventSource } from "@/lib/sse";
import { getAdminGuildId } from "@/lib/auth-store";
import {
  Plus, Pencil, Trash2, Loader2, CheckCircle2, Clock, Users, Filter, Search,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, Gift,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface Mission {
  id: string;
  name: string;
  type: string;
  objective: string;
  reward: number;
  frequency: string;
}

interface ProgressEntry {
  id: string;
  discordId: string;
  username: string;
  missionId: string;
  missionName: string;
  missionType: string;
  objective: number;
  reward: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
  resetAt: string | null;
}

interface FormState {
  name: string;
  type: string;
  objective: string;
  reward: number;
  frequency: string;
}

type Action =
  | { type: "SET_MISSIONS"; payload: Mission[] }
  | { type: "SET_PROGRESS"; payload: ProgressEntry[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_TAB"; payload: "missions" | "progress" }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: Mission }
  | { type: "CLOSE_MODAL" }
  | { type: "UPDATE_FORM"; payload: Partial<FormState> };

interface State {
  missions: Mission[];
  progress: ProgressEntry[];
  loading: boolean;
  tab: "missions" | "progress";
  showModal: boolean;
  editingMission: Mission | null;
  form: FormState;
}

const initialForm: FormState = { name: "", type: "", objective: "", reward: 0, frequency: "DAILY" };
const PAGE_SIZE = 25;

type SortKey = "username" | "missionName" | "progress" | "completed" | "reward" | "updatedAt" | "resetAt";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_MISSIONS":
      return { ...state, missions: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_TAB":
      return { ...state, tab: action.payload };
    case "OPEN_CREATE":
      return { ...state, editingMission: null, form: initialForm, showModal: true };
    case "OPEN_EDIT":
      return { ...state, editingMission: action.payload, form: { name: action.payload.name, type: action.payload.type, objective: action.payload.objective, reward: action.payload.reward, frequency: action.payload.frequency }, showModal: true };
    case "CLOSE_MODAL":
      return { ...state, showModal: false };
    case "UPDATE_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    default:
      return state;
  }
}

const missionTabs = [
  { id: "missions" as const, label: "Misiones", icon: <Plus className="h-4 w-4" /> },
  { id: "progress" as const, label: "Progreso", icon: <Users className="h-4 w-4" /> },
];

/** Formatea fecha completa corta */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Nombre legible del tipo de misión */
function missionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    send_messages: "Mensajes",
    voice_minutes: "Voz",
    xp_earned: "XP",
    level_up: "Nivel",
    daily_login: "Login",
    role_gift: "Regalo de Rol",
  };
  return labels[type] || type;
}

/** Nombre legible de la frecuencia */
function frequencyLabel(freq: string): string {
  const labels: Record<string, string> = {
    DAILY: "Diaria",
    WEEKLY: "Semanal",
    MONTHLY: "Mensual",
    UNICA: "Única",
  };
  return labels[freq] || freq;
}

export default function MissionsPage() {
  const [state, dispatch] = useReducer(reducer, {
    missions: [], progress: [], loading: true, tab: "missions",
    showModal: false, editingMission: null, form: initialForm,
  });
  const { missions, progress, loading, tab, showModal, editingMission, form } = state;
  const { toast, confirm } = useToast();

  // ── Filtros ──
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");
  const [missionSearch, setMissionSearch] = useState<string>("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  // ── Ordenamiento ──
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Paginación ──
  const [page, setPage] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "username" || key === "missionName" ? "asc" : "desc");
    }
    setPage(0);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3 w-3 inline text-primary-400" />
      : <ChevronDown className="ml-1 h-3 w-3 inline text-primary-400" />;
  };

  // Tipos únicos
  const missionTypes = useMemo(() => {
    const types = new Set(progress.map((p) => p.missionType));
    return Array.from(types).sort();
  }, [progress]);

  // Nombres de misiones únicos para datalist
  const missionNames = useMemo(() => {
    const names = new Set(progress.map((p) => p.missionName));
    return Array.from(names).sort();
  }, [progress]);

  // Usuarios únicos para datalist
  const userNames = useMemo(() => {
    const names = new Set(progress.map((p) => p.username || p.discordId));
    return Array.from(names).sort();
  }, [progress]);

  // Aplicar filtros + ordenamiento
  const filteredProgress = useMemo(() => {
    let filtered = progress;

    if (typeFilter) {
      filtered = filtered.filter((p) => p.missionType === typeFilter);
    }

    if (userSearch) {
      const q = userSearch.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.username || "").toLowerCase().includes(q) || p.discordId.toLowerCase().includes(q)
      );
    }

    if (missionSearch) {
      const q = missionSearch.toLowerCase();
      filtered = filtered.filter((p) => p.missionName.toLowerCase().includes(q));
    }

    if (incompleteOnly) {
      filtered = filtered.filter((p) => !p.completed);
    }

    // Ordenar
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "username":
          cmp = (a.username || a.discordId).localeCompare(b.username || b.discordId);
          break;
        case "missionName":
          cmp = a.missionName.localeCompare(b.missionName);
          break;
        case "progress": {
          const pctA = a.objective > 0 ? a.progress / a.objective : 0;
          const pctB = b.objective > 0 ? b.progress / b.objective : 0;
          cmp = pctA - pctB;
          break;
        }
        case "completed":
          cmp = Number(a.completed) - Number(b.completed);
          break;
        case "reward":
          cmp = a.reward - b.reward;
          break;
        case "updatedAt":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "resetAt": {
          const ra = a.resetAt ? new Date(a.resetAt).getTime() : 0;
          const rb = b.resetAt ? new Date(b.resetAt).getTime() : 0;
          cmp = ra - rb;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [progress, typeFilter, userSearch, missionSearch, incompleteOnly, sortKey, sortDir]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredProgress.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filteredProgress.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalEntries = progress.length;
  const filteredCount = filteredProgress.length;

  const load = useCallback(() => {
    return api.get<{ data: Mission[] }>("/missions")
      .then((res) => dispatch({ type: "SET_MISSIONS", payload: res.data }))
      .catch(console.error);
  }, []);

  const loadProgress = useCallback(() => {
    return api.get<{ data: ProgressEntry[] }>("/missions/progress")
      .then((res) => dispatch({ type: "SET_PROGRESS", payload: res.data }))
      .catch(console.error);
  }, []);

  useEffect(() => {
    let progressPollId: ReturnType<typeof setInterval>;
    let missionsPollId: ReturnType<typeof setInterval>;
    let sseClient: FetchEventSource | null = null;
    let pollingStarted = false;

    const startPolling = () => {
      if (pollingStarted) return;
      pollingStarted = true;
      progressPollId = setInterval(loadProgress, 5_000);
      missionsPollId = setInterval(load, 30_000);
    };

    const connectSSE = () => {
      try {
        const guildId = getAdminGuildId();
        if (!guildId) { startPolling(); return; }

        // Usar la ruta relativa para que pase por el rewrite de Next.js
        // y la cookie HttpOnly se envíe automáticamente
        const sseUrl = `${window.location.origin}/api/sse/missions?guildId=${guildId}`;
        sseClient = new FetchEventSource(
          sseUrl,
          "",
          {
            onMessage: (data: unknown) => {
              const d = data as { type?: string };
              if (d.type === "mission_update") {
                load();
                loadProgress();
              } else if (d.type === "mission_progress") {
                loadProgress();
              }
            },
            onError: () => {
              startPolling();
            },
          }
        );
      } catch {
        startPolling();
      }
    };

    Promise.all([load(), loadProgress()]).finally(() => dispatch({ type: "SET_LOADING", payload: false }));
    connectSSE();

    return () => {
      sseClient?.close();
      clearInterval(progressPollId);
      clearInterval(missionsPollId);
    };
  }, [load, loadProgress]);

  const openCreate = () => dispatch({ type: "OPEN_CREATE" });
  const openEdit = (m: Mission) => dispatch({ type: "OPEN_EDIT", payload: m });

  const handleSave = async () => {
    try {
      if (editingMission) {
        await api.put(`/missions/${editingMission.id}`, form);
      } else {
        await api.post("/missions", form);
      }
      dispatch({ type: "CLOSE_MODAL" });
      await Promise.all([load(), loadProgress()]);
      toast("Misión guardada correctamente");
    } catch { toast("Error al guardar misión", "error"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("¿Eliminar esta misión? Se eliminará todo el progreso asociado.");
    if (!ok) return;
    try { await api.delete(`/missions/${id}`); await Promise.all([load(), loadProgress()]); toast("Misión eliminada"); }
    catch { toast("Error al eliminar misión", "error"); }
  };

  const [giftingUserId, setGiftingUserId] = useState<string | null>(null);

  const handleGiftRole = async (discordId: string) => {
    const ok = await confirm("¿Regalar este rol al usuario? Recibirá 5000 XP, subirá de nivel y obtendrá el rango correspondiente.");
    if (!ok) return;
    setGiftingUserId(discordId);
    try {
      await api.post("/missions/simulate", { userId: discordId, type: "role_gift", amount: 1 });
      await loadProgress();
      toast("Rol regalado correctamente!");
    } catch { toast("Error al regalar rol", "error"); }
    finally { setGiftingUserId(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Misiones</h1>
        <div className="flex gap-2">
          {missionTabs.map((t) => (
            <button type="button" key={t.id} onClick={() => { dispatch({ type: "SET_TAB", payload: t.id }); setPage(0); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                tab === t.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
          {tab === "missions" && (
            <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white">
              <Plus className="h-4 w-4" /> Nueva Misión
            </button>
          )}
        </div>
      </div>

      {/* ── TAB: MISIONES ── */}
      {tab === "missions" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h3 className="text-lg font-semibold text-white">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {missionTypeLabel(m.type)} · {m.objective} · {frequencyLabel(m.frequency)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{missionTypeLabel(m.type)}</span>
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">{frequencyLabel(m.frequency)}</span>
                <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">{m.reward} XP</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(m)}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button type="button" onClick={() => handleDelete(m.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20">
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: PROGRESO ── */}
      {tab === "progress" && (
        <div>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <Filter className="h-5 w-5 text-slate-400" />

            {/* Filtro por tipo */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos los tipos</option>
              {missionTypes.map((t) => (
                <option key={t} value={t}>{missionTypeLabel(t)}</option>
              ))}
            </select>

            {/* Búsqueda por misión */}
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={missionSearch}
                onChange={(e) => { setMissionSearch(e.target.value); setPage(0); }}
                placeholder="Buscar misión..."
                list="mission-list"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                aria-label="Buscar misión"
              />
              <datalist id="mission-list">
                {missionNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Búsqueda por usuario */}
            <div className="relative min-w-[160px] flex-1">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setPage(0); }}
                placeholder="Buscar usuario..."
                list="user-list"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                aria-label="Buscar usuario"
              />
              <datalist id="user-list">
                {userNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Checkbox: solo en curso */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
              <input
                type="checkbox"
                checked={incompleteOnly}
                onChange={(e) => { setIncompleteOnly(e.target.checked); setPage(0); }}
                className="rounded border-slate-600"
              />
              <Clock className="h-4 w-4 text-yellow-400" />
              Solo en curso
            </label>

            {/* Contador */}
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {filteredCount} / {totalEntries} resultados
            </span>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/50">
                <tr>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("username")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Usuario <SortIcon column="username" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("missionName")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Misión <SortIcon column="missionName" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("progress")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Progreso <SortIcon column="progress" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("completed")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Estado <SortIcon column="completed" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("reward")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Recompensa <SortIcon column="reward" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("updatedAt")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Actualizado <SortIcon column="updatedAt" />
                    </button>
                  </th>
                  <th className="p-4 font-medium">
                    <button type="button" onClick={() => handleSort("resetAt")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors">
                      Resetea <SortIcon column="resetAt" />
                    </button>
                  </th>
                  <th className="p-4 font-medium text-slate-400">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">
                    {progress.length === 0 ? "Sin progreso aún" : "No se encontraron resultados con los filtros aplicados"}
                  </td></tr>
                )}
                {paginated.map((p) => {
                  const pct = p.objective > 0 ? Math.min(100, Math.round((p.progress / p.objective) * 100)) : 0;
                  return (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4 font-medium text-white whitespace-nowrap">{p.username || p.discordId}</td>
                      <td className="p-4 whitespace-nowrap">{p.missionName}</td>
                      <td className="p-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-slate-700 flex-shrink-0">
                            <div className={`h-full rounded-full transition-all ${p.completed ? "bg-green-500" : "bg-primary-500"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {p.progress}/{p.objective}
                            <span className="text-slate-600 ml-1">({pct}%)</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {p.completed ? (
                          <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="h-4 w-4" /> Completada</span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-400"><Clock className="h-4 w-4" /> En curso</span>
                        )}
                      </td>
                      <td className="p-4 text-yellow-400 whitespace-nowrap">{p.reward} XP</td>
                      <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{formatDate(p.updatedAt)}</td>
                      <td className="p-4 text-slate-500 whitespace-nowrap">
                        {p.resetAt ? (
                          <span className="text-slate-400">
                            {new Date(p.resetAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {p.missionType === "role_gift" && !p.completed && (
                          <button type="button" onClick={() => handleGiftRole(p.discordId)} disabled={giftingUserId === p.discordId}
                            className="flex items-center gap-1 rounded-lg bg-green-600/20 px-3 py-1.5 text-sm text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50">
                            {giftingUserId === p.discordId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gift className="h-3 w-3" />}
                            Regalar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              {/* Páginas */}
              <div className="flex items-center gap-1">
                {(() => {
                const items: React.ReactNode[] = [];
                let lastShown = -1;
                for (let i = 0; i < totalPages; i++) {
                  const show =
                    totalPages <= 7 ||
                    i === 0 ||
                    i === totalPages - 1 ||
                    (i >= safePage - 2 && i <= safePage + 2);
                  if (show) {
                    if (lastShown !== -1 && i - lastShown > 1) {
                      items.push(<span key={`e${i}`} className="text-slate-600 px-1 select-none">...</span>);
                    }
                    items.push(
                      <button key={i} type="button" onClick={() => setPage(i)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                          i === safePage ? "bg-primary-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}>
                        {i + 1}
                      </button>
                    );
                    lastShown = i;
                  }
                }
                return items;
              })()}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>

              <span className="text-xs text-slate-600 ml-2">
                Pág. {safePage + 1} de {totalPages}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-6 text-xl font-bold text-white">
              {editingMission ? "Editar Misión" : "Nueva Misión"}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="mission-name" className="mb-1 block text-sm text-slate-400">Nombre</label>
                <input id="mission-name" value={form.name} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
              <div>
                <label htmlFor="mission-type" className="mb-1 block text-sm text-slate-400">Tipo</label>
                  <select id="mission-type" value={form.type} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { type: e.target.value } })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                    <option value="" disabled>Seleccionar tipo</option>
                    <option value="send_messages">Enviar mensajes</option>
                    <option value="voice_minutes">Minutos en voz</option>
                    <option value="xp_earned">Ganar XP</option>
                    <option value="level_up">Subir de nivel</option>
                    <option value="daily_login">Inicio de sesión diario</option>
                    <option value="role_gift">Regalar rol (+XP y nivel)</option>
                  </select>
              </div>
              <div>
                <label htmlFor="mission-objective" className="mb-1 block text-sm text-slate-400">Objetivo (cantidad)</label>
                <input id="mission-objective" type="number" min="1" value={form.objective} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { objective: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
              <div>
                <label htmlFor="mission-frequency" className="mb-1 block text-sm text-slate-400">Frecuencia</label>
                <select id="mission-frequency" value={form.frequency} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { frequency: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="UNICA">Única (una vez)</option>
                </select>
              </div>
              <div>
                <label htmlFor="mission-reward" className="mb-1 block text-sm text-slate-400">Recompensa (XP)</label>
                <input id="mission-reward" type="number" value={form.reward} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { reward: parseInt(e.target.value) || 0 } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => dispatch({ type: "CLOSE_MODAL" })}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-white hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={handleSave}
                className="flex-1 rounded-lg bg-primary-600 py-2 text-white hover:bg-primary-700">
                {editingMission ? "Actualizar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
