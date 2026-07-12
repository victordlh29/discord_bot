"use client";

import { useEffect, useReducer, useCallback } from "react";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Cosmetic {
  id: string;
  name: string;
  type: string;
  rarity: string;
  imageUrl: string | null;
}

interface FormState {
  name: string;
  type: string;
  rarity: string;
  imageUrl: string;
}

type Action =
  | { type: "SET_COSMETICS"; payload: Cosmetic[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; payload: Cosmetic }
  | { type: "CLOSE_MODAL" }
  | { type: "UPDATE_FORM"; payload: Partial<FormState> };

interface State {
  cosmetics: Cosmetic[];
  loading: boolean;
  showModal: boolean;
  editing: Cosmetic | null;
  form: FormState;
}

const initialForm: FormState = { name: "", type: "TITLE", rarity: "COMMON", imageUrl: "" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_COSMETICS":
      return { ...state, cosmetics: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "OPEN_CREATE":
      return { ...state, editing: null, form: initialForm, showModal: true };
    case "OPEN_EDIT":
      return { ...state, editing: action.payload, form: { name: action.payload.name, type: action.payload.type, rarity: action.payload.rarity, imageUrl: action.payload.imageUrl || "" }, showModal: true };
    case "CLOSE_MODAL":
      return { ...state, showModal: false };
    case "UPDATE_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    default:
      return state;
  }
}

const rarityColors: Record<string, string> = {
  COMMON: "bg-slate-500/20 text-slate-400",
  UNCOMMON: "bg-green-500/20 text-green-400",
  RARE: "bg-blue-500/20 text-blue-400",
  EPIC: "bg-purple-500/20 text-purple-400",
  LEGENDARY: "bg-yellow-500/20 text-yellow-400",
};

const typeLabels: Record<string, string> = {
  TITLE: "Título",
  BADGE: "Insignia",
  BACKGROUND: "Fondo",
  FRAME: "Marco",
};

export default function CosmeticsPage() {
  const [state, dispatch] = useReducer(reducer, { cosmetics: [], loading: true, showModal: false, editing: null, form: initialForm });

  const load = useCallback(() => {
    api.get<{ data: Cosmetic[] }>("/cosmetics")
      .then((res) => dispatch({ type: "SET_COSMETICS", payload: res.data }))
      .catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { cosmetics, loading, showModal, editing, form } = state;
  const { toast, confirm } = useToast();

  const openCreate = () => dispatch({ type: "OPEN_CREATE" });

  const openEdit = (c: Cosmetic) => dispatch({ type: "OPEN_EDIT", payload: c });

  const handleSave = async () => {
    try {
      const body = { ...form, imageUrl: form.imageUrl || null };
      if (editing) {
        await api.put(`/cosmetics/${editing.id}`, body);
      } else {
        await api.post("/cosmetics", body);
      }
      dispatch({ type: "CLOSE_MODAL" });
      load();
      toast(editing ? "Cosmético actualizado" : "Cosmético creado");
    } catch { toast("Error al guardar cosmético", "error"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("¿Eliminar este cosmético?");
    if (!ok) return;
    try { await api.delete(`/cosmetics/${id}`); load(); toast("Cosmético eliminado"); }
    catch { toast("Error al eliminar", "error"); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-400" /></div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Cosméticos</h1>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white">
          <Plus className="h-4 w-4" /> Nuevo Cosmético
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cosmetics.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-lg font-semibold text-white">{c.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{typeLabels[c.type] || c.type}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${rarityColors[c.rarity] || rarityColors.COMMON}`}>{c.rarity}</span>
            </div>
            {c.imageUrl && <p className="mt-2 text-xs text-slate-500 truncate">{c.imageUrl}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => openEdit(c)} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
                <Pencil className="h-3 w-3" /> Editar
              </button>
              <button type="button" onClick={() => handleDelete(c.id)} className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20">
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-6 text-xl font-bold text-white">
              {editing ? "Editar Cosmético" : "Nuevo Cosmético"}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="cosmetic-name" className="mb-1 block text-sm text-slate-400">Nombre</label>
                <input id="cosmetic-name" value={form.name} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </div>
              <div>
                <label htmlFor="cosmetic-type" className="mb-1 block text-sm text-slate-400">Tipo</label>
                <select id="cosmetic-type" value={form.type} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { type: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                  <option value="TITLE">Título</option>
                  <option value="BADGE">Insignia</option>
                  <option value="BACKGROUND">Fondo</option>
                  <option value="FRAME">Marco</option>
                </select>
              </div>
              <div>
                <label htmlFor="cosmetic-rarity" className="mb-1 block text-sm text-slate-400">Rareza</label>
                <select id="cosmetic-rarity" value={form.rarity} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { rarity: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                  <option value="COMMON">Común</option>
                  <option value="UNCOMMON">Poco Común</option>
                  <option value="RARE">Raro</option>
                  <option value="EPIC">Épico</option>
                  <option value="LEGENDARY">Legendario</option>
                </select>
              </div>
              <div>
                <label htmlFor="cosmetic-url" className="mb-1 block text-sm text-slate-400">URL de imagen (opcional)</label>
                <input id="cosmetic-url" value={form.imageUrl} onChange={(e) => dispatch({ type: "UPDATE_FORM", payload: { imageUrl: e.target.value } })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                  placeholder="https://ejemplo.com/imagen.png" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => dispatch({ type: "CLOSE_MODAL" })}
                className="flex-1 rounded-lg bg-slate-800 py-2 text-white hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={handleSave}
                className="flex-1 rounded-lg bg-primary-600 py-2 text-white hover:bg-primary-700">
                {editing ? "Actualizar" : "Crear"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
