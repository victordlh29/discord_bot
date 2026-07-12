"use client";

import { useEffect, useReducer } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  details: string | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  SETTINGS_UPDATE: "text-blue-400",
  RANK_CREATE: "text-green-400",
  RANK_UPDATE: "text-yellow-400",
  RANK_DELETE: "text-red-400",
  RANK_UP: "text-purple-400",
  EVENT_CREATE: "text-green-400",
  EVENT_UPDATE: "text-yellow-400",
  EVENT_DELETE: "text-red-400",
  EVENT_ACTIVATE: "text-emerald-400",
  EVENT_DEACTIVATE: "text-orange-400",
  MISSION_CREATE: "text-green-400",
  COSMETIC_CREATE: "text-pink-400",
  LEVEL_UP: "text-cyan-400",
};

interface State {
  logs: LogEntry[];
  loading: boolean;
  page: number;
  totalPages: number;
}

type Action =
  | { type: "SET_DATA"; payload: { logs: LogEntry[]; totalPages: number } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PAGE"; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, logs: action.payload.logs, totalPages: action.payload.totalPages, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PAGE":
      return { ...state, page: action.payload };
    default:
      return state;
  }
}

export default function LogsPage() {
  const [state, dispatch] = useReducer(reducer, { logs: [], loading: true, page: 1, totalPages: 1 });
  const { logs, loading, page, totalPages } = state;

  useEffect(() => {
    dispatch({ type: "SET_LOADING", payload: true });
    api.get<{ data: LogEntry[]; pagination: { page: number; totalPages: number } }>(`/logs?page=${page}&limit=30`)
      .then((res) => dispatch({ type: "SET_DATA", payload: { logs: res.data, totalPages: res.pagination.totalPages } }))
      .catch(console.error);
  }, [page]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>;

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-white">Logs del Sistema</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="p-4 font-medium">Acción</th>
              <th className="p-4 font-medium">Entidad</th>
              <th className="p-4 font-medium">Usuario</th>
              <th className="p-4 font-medium">Detalles</th>
              <th className="p-4 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className={`p-4 font-medium ${actionColors[log.action] || "text-slate-300"}`}>{log.action}</td>
                <td className="p-4 text-slate-500">{log.entity || "-"}</td>
                <td className="p-4 text-slate-500">{log.userId ? `<@${log.userId}>` : "-"}</td>
                <td className="max-w-xs truncate p-4 text-slate-500">{log.details || "-"}</td>
                <td className="p-4 text-slate-500">{formatDate(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button type="button"
            disabled={page <= 1}
            onClick={() => dispatch({ type: "SET_PAGE", payload: page - 1 })}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="flex items-center px-4 text-sm text-slate-400">
            Página {page} de {totalPages}
          </span>
          <button type="button"
            disabled={page >= totalPages}
            onClick={() => dispatch({ type: "SET_PAGE", payload: page + 1 })}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
