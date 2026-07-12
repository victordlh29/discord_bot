"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Save, Loader2, ShieldCheck, Eye, Users, Hash, Crown, AlertCircle } from "lucide-react";
import { useToast } from "@/components/Toast";

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface RoleInfo {
  id: string;
  name: string;
  color: string;
}

interface MemberInfo {
  discordId: string;
  username: string;
  displayName: string;
  roles: string[];
}

interface AccessStatus {
  allowedRoles: RoleInfo[];
  membersWithAccess: MemberInfo[];
  totalMembers: number;
  serverOwnerId: string;
  guildId: string;
  guildName: string;
}

export default function AccessControlPage() {
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Status state
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const { toast } = useToast();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get<{ data: DiscordRole[] }>("/roles"),
      api.get<{ data: Record<string, string> }>("/settings"),
    ])
      .then(([rolesRes, settingsRes]) => {
        setRoles(rolesRes.data);
        const saved = settingsRes.data["allowed_dashboard_roles"] || "";
        setSelectedRoles(saved ? saved.split(",").filter(Boolean) : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadStatus = () => {
    setLoadingStatus(true);
    setStatusError("");
    api.get<{ data: AccessStatus }>("/access/status")
      .then((res) => setStatus(res.data))
      .catch((err) => setStatusError("Error al cargar el estado: " + (err instanceof Error ? err.message : "Error desconocido")))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(() => {
    loadData();
    loadStatus();
  }, []);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { allowed_dashboard_roles: selectedRoles.join(",") });
      toast("Roles de acceso guardados exitosamente");
      loadStatus(); // refrescar estado
    } catch {
      toast("Error al guardar los roles de acceso", "error");
    } finally {
      setSaving(false);
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
        <div>
          <h1 className="text-3xl font-bold text-white">Control de Acceso</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestioná quién puede acceder al dashboard y mirá el estado actual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={loadStatus}
            disabled={loadingStatus}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            {loadingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Refrescar
          </button>
          <button type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* ── Visión general del estado ── */}
      {statusError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {statusError}
        </div>
      )}

      {loadingStatus && (
        <div className="mb-6 flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/30 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
          <span className="ml-3 text-sm text-slate-400">Cargando estado del servidor...</span>
        </div>
      )}

      {status && !loadingStatus && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">
              Estado actual — {status.guildName}
            </h2>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <ShieldCheck className="h-4 w-4" />
                Roles permitidos
              </div>
              <p className="mt-1 text-2xl font-bold text-white">{status.allowedRoles.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Users className="h-4 w-4" />
                Miembros con acceso
              </div>
              <p className="mt-1 text-2xl font-bold text-white">{status.membersWithAccess.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Hash className="h-4 w-4" />
                Total del servidor
              </div>
              <p className="mt-1 text-2xl font-bold text-white">{status.totalMembers}</p>
            </div>
          </div>

          {/* Roles permitidos */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-slate-400">Roles que tienen acceso</h3>
            {status.allowedRoles.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No hay roles configurados. Solo el dueño del servidor tiene acceso.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {status.allowedRoles.map((role) => (
                  <span
                    key={role.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                    style={{
                      backgroundColor: role.color !== "#666666" ? `${role.color}20` : "#334155",
                      color: role.color !== "#666666" ? role.color : "#94a3b8",
                      border: `1px solid ${role.color !== "#666666" ? `${role.color}40` : "#475569"}`,
                    }}
                  >
                    {role.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Miembros con acceso */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-400">
              Miembros con acceso ({status.membersWithAccess.length})
            </h3>
            {status.membersWithAccess.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No hay miembros con acceso.
              </p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {status.membersWithAccess.length > 200 && (
                  <p className="mb-2 text-xs text-slate-500">
                    Mostrando los primeros 200 de {status.membersWithAccess.length} miembros
                  </p>
                )}
                {status.membersWithAccess.slice(0, 200).map((member) => (
                  <div
                    key={member.discordId}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      {member.discordId === status.serverOwnerId && (
                        <Crown className="h-4 w-4 text-yellow-400" aria-label="Dueño del servidor" />
                      )}
                      <span className="text-sm text-white">{member.displayName}</span>
                      <span className="text-xs text-slate-500">@{member.username}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-md bg-primary-900/30 px-2 py-0.5 text-xs text-primary-300"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Configuración de roles permitidos ── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Configurar roles permitidos</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Seleccioná los roles de Discord que pueden acceder al dashboard.
          El superadmin (usuario/contraseña) y el dueño del servidor siempre tienen acceso.
        </p>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.id)}
                onChange={() => toggleRole(role.id)}
                className="rounded border-slate-600"
              />
              <span
                className="text-sm font-medium"
                style={{ color: role.color !== "#000000" ? role.color : undefined }}
              >
                {role.name}
              </span>
            </label>
          ))}
          {roles.length === 0 && (
            <p className="text-sm text-slate-500">No se pudieron cargar los roles</p>
          )}
        </div>
      </div>
    </div>
  );
}
