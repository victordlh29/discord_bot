"use client";

import { useEffect, useReducer } from "react";
import { api } from "@/lib/api";
import { formatXp } from "@/lib/utils";
import { Trophy, Mic, BarChart3, Loader2 } from "lucide-react";

interface User {
  discordId: string;
  username: string;
  xp: string;
  level: number;
  voiceTime: number;
  rank: { name: string; color: string } | null;
}

type Tab = "xp" | "voice" | "level";

interface State {
  users: User[];
  loading: boolean;
  tab: Tab;
}

type Action =
  | { type: "SET_USERS"; payload: User[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_TAB"; payload: Tab };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USERS":
      return { ...state, users: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_TAB":
      return { ...state, tab: action.payload };
    default:
      return state;
  }
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "xp", label: "Top XP", icon: <Trophy className="h-4 w-4" /> },
  { id: "voice", label: "Top Voz", icon: <Mic className="h-4 w-4" /> },
  { id: "level", label: "Top Nivel", icon: <BarChart3 className="h-4 w-4" /> },
];

export default function LeaderboardPage() {
  const [state, dispatch] = useReducer(reducer, { users: [], loading: true, tab: "xp" });
  const { users, loading, tab } = state;

  useEffect(() => {
    dispatch({ type: "SET_LOADING", payload: true });
    api.get<{ data: User[] }>(`/leaderboard/${tab}`)
      .then((res) => dispatch({ type: "SET_USERS", payload: res.data }))
      .catch(console.error);
  }, [tab]);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-white">Leaderboard</h1>
      <div className="mb-6 flex gap-2">
        {tabs.map((t) => (
          <button type="button"
            key={t.id}
            onClick={() => dispatch({ type: "SET_TAB", payload: t.id })}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              tab === t.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : (
        <div className="space-y-3">
          {users.map((u, i) => (
            <div key={u.discordId} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                i === 1 ? "bg-slate-400/20 text-slate-300" :
                i === 2 ? "bg-orange-500/20 text-orange-400" :
                "bg-slate-800 text-slate-500"
              }`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-white">{u.username || u.discordId}</p>
                <p className="text-sm text-slate-400" style={{ color: u.rank?.color || "#6366f1" }}>
                  {u.rank?.name || "Sin rango"}
                </p>
              </div>
              <div className="text-right">
                {tab === "xp" && <p className="font-bold text-white">{formatXp(u.xp)} XP</p>}
                {tab === "voice" && <p className="font-bold text-white">{Math.floor(u.voiceTime / 60)}h {u.voiceTime % 60}m</p>}
                {tab === "level" && <p className="font-bold text-white">Nivel {u.level}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
