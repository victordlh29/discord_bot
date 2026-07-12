"use client";

import { useEffect, useState, useCallback, useRef, useReducer } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, Play, Square, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Event {
  id: string;
  name: string;
  type: string;
  duration: number;
  reward: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

function calcMs(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

function calcDisplay(endsAt: string | null): string {
  const ms = calcMs(endsAt);
  if (ms <= 0) return "✅ Finalizado";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function Countdown({ endsAt, onEnd }: { endsAt: string | null; onEnd?: () => void }) {
  const [display, setDisplay] = useState(() => calcDisplay(endsAt));
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!endsAt) { setDisplay("Sin límite"); return; }
    endedRef.current = false;
    const update = () => {
      const ms = calcMs(endsAt);
      if (ms <= 0) {
        setDisplay("✅ Finalizado");
        if (!endedRef.current) {
          endedRef.current = true;
          onEndRef.current?.();
        }
        return;
      }
      setDisplay(calcDisplay(endsAt));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return <span className="text-slate-400">Sin límite</span>;
  return <span className="font-mono text-yellow-400">{display || "0m 0s"}</span>;
}

type Action =
  | { type: "SET_EVENTS"; payload: Event[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_INACTIVE"; payload: string }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: Event }
  | { type: "CLOSE_MODAL" }
  | { type: "UPDATE_FORM"; payload: Partial<{ name: string; type: string; duration: number; reward: number }> };

interface State {
  events: Event[];
  loading: boolean;
  showModal: boolean;
  editingEvent: Event | null;
  form: { name: string; type: string; duration: number; reward: number };
}  const initialForm = { name: "", type: "CHAT", duration: 60, reward: 0 };

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_EVENTS":
      return { ...state, events: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_INACTIVE":
      return { ...state, events: state.events.map((ev) => ev.id === action.payload ? { ...ev, isActive: false } : ev) };
    case "OPEN_CREATE":
      return { ...state, editingEvent: null, form: initialForm, showModal: true };
    case "OPEN_EDIT":
      return { ...state, editingEvent: action.payload, form: { name: action.payload.name, type: action.payload.type, duration: action.payload.duration, reward: action.payload.reward }, showModal: true };
    case "CLOSE_MODAL":
      return { ...state, showModal: false };
    case "UPDATE_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    default:
      return state;
  }
}

export default function EventsPage() {
  const [state, dispatch] = useReducer(reducer, {
    events: [], loading: true, showModal: false, editingEvent: null, form: initialForm,
  });
  const { events, loading, showModal, editingEvent, form } = state;
  const { toast, confirm } = useToast();

  const load = useCallback(() => {
    api.get<{ data: Event[] }>("/events")
      .then((res) => dispatch({ type: "SET_EVENTS", payload: res.data }))
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const openCreate = () => dispatch({ type: "OPEN_CREATE" });

  const openEdit = (e: Event) => dispatch({ type: "OPEN_EDIT", payload: e });

  const handleSave = async () => {
    try {
      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, form);
      } else {
        await api.post("/events", form);
      }
      dispatch({ type: "CLOSE_MODAL" });
      load();
      toast(editingEvent ? "Evento actualizado" : "Evento creado");
    } catch { toast("Error al guardar evento", "error"); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.put(`/events/${id}/${current ? "deactivate" : "activate"}`);
      load();
      toast(current ? "Evento desactivado" : "Evento activado");
    } catch { toast("Error al cambiar estado", "error"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("¿Eliminar este evento?");
    if (!ok) return;
    try { await api.delete(`/events/${id}`); load(); toast("Evento eliminado"); }
    catch { toast("Error al eliminar", "error"); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Eventos</h1>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white">
          <Plus className="h-4 w-4" /> Nuevo Evento
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="p-4 font-medium">Nombre</th>
              <th className="p-4 font-medium">Tipo</th>
              <th className="p-4 font-medium">Duración</th>
              <th className="p-4 font-medium">Recompensa</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium">Cuenta Regresiva</th>
              <th className="p-4 font-medium">Creado</th>
              <th className="p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="p-4 font-medium text-white">{e.name}</td>
                <td className="p-4">{e.type}</td>
                <td className="p-4">{formatDuration(e.duration)}</td>
                <td className="p-4">{e.reward} XP</td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${e.isActive ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                    {e.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-4">
                  <Countdown endsAt={e.endsAt} onEnd={() => dispatch({ type: "SET_INACTIVE", payload: e.id })} />
                </td>
                <td className="p-4 text-slate-500">{formatDate(e.createdAt)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(e)} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
                      <Pencil className="h-4 w-4 text-blue-400" />
                    </button>
                    <button type="button" onClick={() => toggleActive(e.id, e.isActive)} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
                      {e.isActive ? <Square className="h-4 w-4 text-red-400" /> : <Play className="h-4 w-4 text-green-400" />}
                    </button>
                    <button type="button" onClick={() => handleDelete(e.id)} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-6 text-xl font-bold text-white">
              {editingEvent ? "Editar Evento" : "Nuevo Evento"}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="event-name" className="mb-1 block text-sm text-slate-400">Nombre</label>
                <input id="event-name" value={form.name} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
              <div>
                <label htmlFor="event-type" className="mb-1 block text-sm text-slate-400">Tipo</label>
                <select id="event-type" value={form.type} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { type: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                  <option value="CHAT">Chat</option>
                  <option value="VOICE">Voz</option>
                  <option value="DOUBLE_XP">Doble XP</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Duración</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="event-minutes" className="mb-1 block text-xs text-slate-500">Minutos</label>
                    <input id="event-minutes" type="number" min="0" value={Math.floor(form.duration / 60)} onChange={(e) => {
                      const mins = Math.max(0, parseInt(e.target.value) || 0);
                      const secs = form.duration % 60;
                      dispatch({ type: "UPDATE_FORM", payload: { duration: mins * 60 + secs } });
                    }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="event-seconds" className="mb-1 block text-xs text-slate-500">Segundos</label>
                    <input id="event-seconds" type="number" min="0" max="59" value={form.duration % 60} onChange={(e) => {
                      const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      const mins = Math.floor(form.duration / 60);
                      dispatch({ type: "UPDATE_FORM", payload: { duration: mins * 60 + secs } });
                    }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">Total: {formatDuration(form.duration)}</p>
              </div>
              <div>
                <label htmlFor="event-reward" className="mb-1 block text-sm text-slate-400">Recompensa (XP)</label>
                <input id="event-reward" type="number" value={form.reward} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { reward: parseInt(e.target.value) || 0 } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => dispatch({ type: "CLOSE_MODAL" })}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-white hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={handleSave}
                className="flex-1 rounded-lg bg-primary-600 py-2 text-white hover:bg-primary-700">
                {editingEvent ? "Actualizar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
