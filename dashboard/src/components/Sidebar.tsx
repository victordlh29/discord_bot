"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Trophy,
  Calendar,
  Swords,
  Palette,
  FileText,
  Users,
  BarChart3,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Image,
} from "lucide-react";
import { useState } from "react";
import { useGuild } from "@/lib/guild";
import { removeToken } from "@/lib/auth-store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/access", label: "Control de Acceso", icon: ShieldCheck },
  { href: "/dashboard/settings", label: "Configuración XP", icon: Settings },
  { href: "/dashboard/ranks", label: "Rangos", icon: Trophy },
  { href: "/dashboard/gif-resolver", label: "Resolvedor GIFs", icon: Image },
  { href: "/dashboard/events", label: "Eventos", icon: Calendar },
  { href: "/dashboard/missions", label: "Misiones", icon: Swords },
  { href: "/dashboard/cosmetics", label: "Cosméticos", icon: Palette },
  { href: "/dashboard/users", label: "Usuarios", icon: Users },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/dashboard/logs", label: "Logs", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { guildId, setGuildId, guilds, isSuperAdmin } = useGuild();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Si el servidor no responde, igual limpiamos todo localmente
    }
    removeToken();
    router.push("/");
  };

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-slate-800 p-4">
        <button type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
        {!collapsed && (
          <span className="text-lg font-bold text-white">STAN PLAYA</span>
        )}
      </div>

      {guilds.length > 0 && (
        <div className="border-b border-slate-800 px-3 py-2">
          {isSuperAdmin ? (
            <select
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none"
            >
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-2 py-1.5 text-sm font-medium text-white">
              {guilds.find((g) => g.id === guildId)?.name || "Servidor"}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary-600/20 text-primary-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white transition-colors hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
