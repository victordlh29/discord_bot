"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Trophy, Mic, MessageSquare, Activity, Zap } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalXp: string;
  totalVoiceTime: number;
  totalMessages: number;
  totalRanks: number;
  activeEvents: number;
  activeMissions: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Stats }>("/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="h-8 w-8 animate-pulse text-primary-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-white">Dashboard Principal</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Usuarios Registrados"
          value={stats?.totalUsers || 0}
          icon={<Users className="h-6 w-6 text-blue-400" />}
          color="bg-blue-500/10"
        />
        <StatCard
          title="XP Total Acumulada"
          value={stats?.totalXp || "0"}
          icon={<Zap className="h-6 w-6 text-yellow-400" />}
          color="bg-yellow-500/10"
        />
        <StatCard
          title="Horas en Voz"
          value={`${Math.floor((stats?.totalVoiceTime || 0) / 60)}h ${(stats?.totalVoiceTime || 0) % 60}m`}
          icon={<Mic className="h-6 w-6 text-green-400" />}
          color="bg-green-500/10"
        />
        <StatCard
          title="Mensajes Procesados"
          value={stats?.totalMessages || 0}
          icon={<MessageSquare className="h-6 w-6 text-purple-400" />}
          color="bg-purple-500/10"
        />
        <StatCard
          title="Rangos Creados"
          value={stats?.totalRanks || 0}
          icon={<Trophy className="h-6 w-6 text-orange-400" />}
          color="bg-orange-500/10"
        />
        <StatCard
          title="Eventos Activos"
          value={stats?.activeEvents || 0}
          icon={<Activity className="h-6 w-6 text-red-400" />}
          color="bg-red-500/10"
        />
      </div>
    </div>
  );
}
