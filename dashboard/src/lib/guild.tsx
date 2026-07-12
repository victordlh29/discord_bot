"use client";
import { createContext, use, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { api } from "./api";
import { getAdminGuildId, getIsSuperAdmin } from "./auth-store";

interface DiscordGuild {
  id: string;
  name: string;
}

const GuildContext = createContext<{
  guildId: string;
  setGuildId: (id: string) => void;
  guilds: DiscordGuild[];
  isSuperAdmin: boolean;
}>({ guildId: "", setGuildId: (_id: string) => { /* set by GuildProvider */ }, guilds: [], isSuperAdmin: false });

function getInitialGuildId(): string {
  return getAdminGuildId() || "";
}

function getInitialIsSuperAdmin(): boolean {
  return getIsSuperAdmin();
}

export function GuildProvider({ children }: { children: ReactNode }) {
  const [guildId, setGuildId] = useState(getInitialGuildId);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [isSuperAdmin] = useState(getInitialIsSuperAdmin);

  useEffect(() => {
    const stored = getInitialGuildId();
    api.get<{ data: { id: string; name: string }[] }>("/guilds")
      .then((res) => {
        setGuilds(res.data);
        if (!stored && res.data.length > 0) {
          const firstId = res.data[0].id;
          setGuildId(firstId);
          localStorage.setItem("adminGuildId", firstId);
        }
      })
      .catch(console.error);
  }, []);

  const handleSetGuildId = useCallback((id: string) => {
    setGuildId(id);
    localStorage.setItem("adminGuildId", id);
  }, []);

  const contextValue = useMemo(() => ({
    guildId,
    setGuildId: handleSetGuildId,
    guilds,
    isSuperAdmin,
  }), [guildId, guilds, isSuperAdmin, handleSetGuildId]);

  return (
    <GuildContext.Provider value={contextValue}>
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  return use(GuildContext);
}
