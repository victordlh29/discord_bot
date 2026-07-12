"use client";

import { useEffect, useReducer, useCallback } from "react";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import GifPreviewCard from "@/components/GifPreviewCard";
import { isPageUrl, normalizeGifUrl } from "@/lib/gif-utils";

interface Rank {
  id: string;
  name: string;
  requiredXp: string;
  discordRoleId: string | null;
  color: string | null;
  icon: string | null;
  gifUrl: string | null;
  position: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface FormState {
  name: string;
  requiredXp: string;
  color: string;
  discordRoleId: string;
  gifUrl: string;
}

type Action =
  | { type: "SET_DATA"; payload: { ranks: Rank[]; roles: DiscordRole[] } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: Rank }
  | { type: "CLOSE_MODAL" }
  | { type: "UPDATE_FORM"; payload: Partial<FormState> };

interface State {
  ranks: Rank[];
  roles: DiscordRole[];
  loading: boolean;
  showModal: boolean;
  editingRank: Rank | null;
  form: FormState;
}

const initialForm: FormState = { name: "", requiredXp: "", color: "#6366f1", discordRoleId: "", gifUrl: "" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, ranks: action.payload.ranks, roles: action.payload.roles, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "OPEN_CREATE":
      return { ...state, editingRank: null, form: initialForm, showModal: true };
    case "OPEN_EDIT": {
      let gifUrl = action.payload.gifUrl || "";
      try {
        const parsed = JSON.parse(gifUrl);
        if (Array.isArray(parsed)) {
          gifUrl = parsed.join("\n");
        }
      } catch { /* not JSON, use raw string */ }
      return { ...state, editingRank: action.payload, form: { name: action.payload.name, requiredXp: String(Number(action.payload.requiredXp)), color: action.payload.color || "#6366f1", discordRoleId: action.payload.discordRoleId || "", gifUrl }, showModal: true };
    }
    case "CLOSE_MODAL":
      return { ...state, showModal: false };
    case "UPDATE_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    default:
      return state;
  }
}

export default function RanksPage() {
  const [state, dispatch] = useReducer(reducer, {
    ranks: [], roles: [], loading: true, showModal: false, editingRank: null, form: initialForm,
  });
  const { ranks, roles, loading, showModal, editingRank, form } = state;
  const { toast, confirm } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [ranksRes, rolesRes] = await Promise.all([
        api.get<{ data: Rank[] }>("/ranks"),
        api.get<{ data: DiscordRole[] }>("/roles"),
      ]);
      dispatch({ type: "SET_DATA", payload: { ranks: ranksRes.data, roles: rolesRes.data } });
    } catch (err) {
      console.error("Error loading ranks data:", err instanceof Error ? err.message : String(err));
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => dispatch({ type: "OPEN_CREATE" });

  const openEdit = (rank: Rank) => dispatch({ type: "OPEN_EDIT", payload: rank });

  const handleSave = async () => {
    try {
      const gifUrl = form.gifUrl
        ? JSON.stringify(form.gifUrl.split("\n").map(s => s.trim()).filter(Boolean).map(normalizeGifUrl))
        : null;
      const body = {
        ...form,
        gifUrl,
        position: editingRank ? undefined : ranks.length + 1,
        requiredXp: parseInt(form.requiredXp),
        discordRoleId: form.discordRoleId || null,
      };
      if (editingRank) {
        await api.put(`/ranks/${editingRank.id}`, body);
      } else {
        await api.post("/ranks", body);
      }
      dispatch({ type: "CLOSE_MODAL" });
      loadData();
      toast(editingRank ? "Rango actualizado" : "Rango creado");
    } catch {
      toast("Error al guardar el rango", "error");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("¿Eliminar este rango?");
    if (!ok) return;
    try {
      await api.delete(`/ranks/${id}`);
      loadData();
      toast("Rango eliminado");
    } catch {
      toast("Error al eliminar", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Rangos</h1>
        <button type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Nuevo Rango
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranks.map((rank) => {
          const linkedRole = roles.find((r) => r.id === rank.discordRoleId);
          return (
            <div key={rank.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: rank.color || "#6366f1" }} />
                <h3 className="text-lg font-semibold text-white">{rank.name}</h3>
              </div>
              <p className="mb-1 text-sm text-slate-400">
                {Number(rank.requiredXp).toLocaleString()} XP requeridos
              </p>
              <p className="mb-4 text-sm text-slate-500">
                Rol: {linkedRole ? (
                  <span style={{ color: linkedRole.color }}>{linkedRole.name}</span>
                ) : (
                  <span className="text-red-400">No vinculado</span>
                )}
              </p>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => openEdit(rank)}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button type="button"
                  onClick={() => handleDelete(rank.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-6 text-xl font-bold text-white">
              {editingRank ? "Editar Rango" : "Nuevo Rango"}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="rank-name" className="mb-1 block text-sm text-slate-400">Nombre</label>
                <input id="rank-name"
                  value={form.name}
                  onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="rank-xp" className="mb-1 block text-sm text-slate-400">XP Requerida</label>
                <input id="rank-xp"
                  type="number"
                  value={form.requiredXp}
                  onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { requiredXp: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="rank-color" className="mb-1 block text-sm text-slate-400">Color</label>
                <input id="rank-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { color: e.target.value } })}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800"
                />
              </div>
              <div>
                <label htmlFor="rank-role" className="mb-1 block text-sm text-slate-400">Rol de Discord</label>
                <select id="rank-role"
                  value={form.discordRoleId}
                  onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { discordRoleId: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="">-- Sin rol vinculado --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rank-gif" className="mb-1 block text-sm text-slate-400">
                  GIFs de rank-up <span className="text-slate-500">(uno por línea, se elige aleatoriamente)</span>
                </label>
                <textarea id="rank-gif"
                  value={form.gifUrl}
                  onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { gifUrl: e.target.value } })}
                  placeholder="https://i.imgur.com/gif1.gif&#10;https://i.imgur.com/gif2.gif&#10;https://i.imgur.com/gif3.gif"
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500"
                />
                {form.gifUrl && form.gifUrl.split("\n").filter(Boolean).length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {form.gifUrl.split("\n").filter(Boolean).slice(0, 6).map((url, i) => (
                      <GifPreviewCard key={i} url={url.trim()} index={i} />
                    ))}
                    {form.gifUrl.split("\n").filter(Boolean).length > 6 && (
                      <p className="col-span-3 text-center text-xs text-slate-500">
                        +{form.gifUrl.split("\n").filter(Boolean).length - 6} más
                      </p>
                    )}
                  </div>
                )}
                {/* Stats: direct GIFs vs page URLs */}
                {(() => {
                  const urls = form.gifUrl.split("\n").filter(s => s.trim());
                  const directGifs = urls.filter(u => !isPageUrl(u.trim()));
                  const pageUrls = urls.filter(u => isPageUrl(u.trim()));
                  const total = urls.length;
                  if (total === 0) return null;
                  return (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-slate-400">
                        {total} URL{total !== 1 ? "s" : ""}
                      </span>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-400">
                        {directGifs.length} GIF{directGifs.length !== 1 ? "s" : ""} directo{directGifs.length !== 1 ? "s" : ""}
                      </span>
                      {pageUrls.length > 0 && (
                        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-400">
                          {pageUrls.length} URL{pageUrls.length !== 1 ? "s" : ""} de página web
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => dispatch({ type: "CLOSE_MODAL" })} className="flex-1 rounded-lg bg-slate-800 py-2 text-white transition-colors hover:bg-slate-700">
                Cancelar
              </button>
              <button type="button" onClick={handleSave} className="flex-1 rounded-lg bg-primary-600 py-2 text-white transition-colors hover:bg-primary-700">
                {editingRank ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
