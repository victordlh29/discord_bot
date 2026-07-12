"use client";

import { useEffect, useReducer, useCallback } from "react";
import { api } from "@/lib/api";
import { formatXp } from "@/lib/utils";
import { useGuild } from "@/lib/guild";
import { Loader2, Search, ShieldCheck, PlusCircle, MinusCircle, RotateCcw } from "lucide-react";

interface User {
  id: string;
  discordId: string;
  username: string;
  xp: string;
  level: number;
  voiceTime: number;
  rank: { name: string; color: string } | null;
}

interface State {
  users: User[];
  loading: boolean;
  search: string;
  actionLoading: string | null;
  message: { text: string; type: "success" | "error" } | null;
  showResetModal: boolean;
  resetting: boolean;
}

type Action =
  | { type: "SET_USERS"; payload: User[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_ACTION_LOADING"; payload: string | null }
  | { type: "SET_MESSAGE"; payload: { text: string; type: "success" | "error" } | null }
  | { type: "SHOW_RESET_MODAL"; payload: boolean }
  | { type: "SET_RESETTING"; payload: boolean };

const initialState: State = {
  users: [], loading: true, search: "", actionLoading: null,
  message: null, showResetModal: false, resetting: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USERS":
      return { ...state, users: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SEARCH":
      return { ...state, search: action.payload };
    case "SET_ACTION_LOADING":
      return { ...state, actionLoading: action.payload };
    case "SET_MESSAGE":
      return { ...state, message: action.payload };
    case "SHOW_RESET_MODAL":
      return { ...state, showResetModal: action.payload };
    case "SET_RESETTING":
      return { ...state, resetting: action.payload };
    default:
      return state;
  }
}

export default function UsersPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { users, loading, search, actionLoading, message, showResetModal, resetting } = state;
  const { isSuperAdmin } = useGuild();

  const loadUsers = useCallback(() => {
    dispatch({ type: "SET_LOADING", payload: true });
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    api.get<{ data: User[] }>(`/users${params}`)
      .then((res) => dispatch({ type: "SET_USERS", payload: res.data }))
      .catch(console.error);
  }, [search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const doAction = async (discordId: string, action: string, _label: string) => {
    const key = `${discordId}-${action}`;
    dispatch({ type: "SET_ACTION_LOADING", payload: key });
    dispatch({ type: "SET_MESSAGE", payload: null });
    try {
      const res = await api.post<{ message: string }>(`/users/${discordId}/${action}`);
      dispatch({ type: "SET_MESSAGE", payload: { text: res.message, type: "success" } });
      loadUsers();
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: "SET_MESSAGE", payload: { text: error.message || `Error al ${_label}`, type: "error" } });
    } finally {
      dispatch({ type: "SET_ACTION_LOADING", payload: null });
    }
  };

  const isLoading = (discordId: string, action: string) => actionLoading === `${discordId}-${action}`;

  const handleResetXp = async () => {
    dispatch({ type: "SET_RESETTING", payload: true });
    dispatch({ type: "SET_MESSAGE", payload: null });
    try {
      const res = await api.post<{ message: string }>("/users/reset-xp");
      dispatch({ type: "SET_MESSAGE", payload: { text: res.message, type: "success" } });
      loadUsers();
    } catch (err: unknown) {
      const error = err as { message?: string };
      dispatch({ type: "SET_MESSAGE", payload: { text: error.message || "Error al reiniciar XP", type: "error" } });
    } finally {
      dispatch({ type: "SET_RESETTING", payload: false });
      dispatch({ type: "SHOW_RESET_MODAL", payload: false });
    }
  };

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-white">Usuarios</h1>

      {message && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar usuario..."
          aria-label="Buscar usuario"
          value={search}
          onChange={(e) => dispatch({ type: "SET_SEARCH", payload: e.target.value })}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
        />
        {isSuperAdmin && (
          <button type="button"
            onClick={() => dispatch({ type: "SHOW_RESET_MODAL", payload: true })}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-600/30"
            title="Reiniciar XP de todos los usuarios"
          >
            <RotateCcw className="h-4 w-4" />
            Reiniciar XP
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/50">
              <tr>
                <th className="p-4 font-medium">Usuario</th>
                <th className="p-4 font-medium">Nivel</th>
                <th className="p-4 font-medium">XP</th>
                <th className="p-4 font-medium">Rango</th>
                <th className="p-4 font-medium">Tiempo Voz</th>
                {isSuperAdmin && <th className="p-4 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 font-medium text-white">{u.username || u.discordId}</td>
                  <td className="p-4">{u.level}</td>
                  <td className="p-4">{formatXp(u.xp)}</td>
                  <td className="p-4">
                    <span style={{ color: u.rank?.color || "#6366f1" }}>{u.rank?.name || "Sin rango"}</span>
                  </td>
                  <td className="p-4">{Math.floor(u.voiceTime / 60)}h {u.voiceTime % 60}m</td>
                  <td className="p-4">
                    <div className="flex gap-1.5">
                      {isSuperAdmin && (
                        <>
                          <button type="button"
                            onClick={() => doAction(u.discordId, "assign-role", "asignar rol")}
                            disabled={isLoading(u.discordId, "assign-role")}
                            className="flex items-center gap-1 rounded-lg bg-primary-600/20 px-2.5 py-1.5 text-xs text-primary-400 transition-colors hover:bg-primary-600/30 disabled:opacity-50"
                            title="Asignar rol según su XP"
                          >
                            {isLoading(u.discordId, "assign-role") ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            Rol
                          </button>
                          <button type="button"
                            onClick={() => doAction(u.discordId, "assign-all-roles", "asignar todos")}
                            disabled={isLoading(u.discordId, "assign-all-roles")}
                            className="flex items-center gap-1 rounded-lg bg-green-600/20 px-2.5 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-600/30 disabled:opacity-50"
                            title="Asignar todos los roles de rango (prueba)"
                          >
                            {isLoading(u.discordId, "assign-all-roles") ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusCircle className="h-3 w-3" />
                            )}
                            Todos
                          </button>
                          <button type="button"
                            onClick={() => doAction(u.discordId, "remove-roles", "quitar roles")}
                            disabled={isLoading(u.discordId, "remove-roles")}
                            className="flex items-center gap-1 rounded-lg bg-red-600/20 px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
                            title="Quitar todos los roles de rango"
                          >
                            {isLoading(u.discordId, "remove-roles") ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MinusCircle className="h-3 w-3" />
                            )}
                            Quitar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-red-800/50 bg-slate-900 p-6">
            <h2 className="mb-2 text-xl font-bold text-red-400">Reiniciar XP</h2>
            <p className="mb-6 text-sm text-slate-400">
              Esto establecerá <strong className="text-white">XP = 0</strong> y <strong className="text-white">nivel = 1</strong> para <strong>TODOS</strong> los usuarios de este servidor.
              Los roles de Discord no se modifican. ¿Estás seguro?
            </p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => dispatch({ type: "SHOW_RESET_MODAL", payload: false })}
                disabled={resetting}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button type="button"
                onClick={handleResetXp}
                disabled={resetting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {resetting ? "Reiniciando..." : "Sí, reiniciar XP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
