import { Client, EmbedBuilder, TextChannel, Message } from "discord.js";
import { Player, GuildQueue, Track, GuildQueueEvent } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, joinVoiceChannel, getVoiceConnection, StreamType } from "@discordjs/voice";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ytDlp from "youtube-dl-exec";
import { logger } from "../../core/utils/logger";
import prisma from "../../core/database/prisma";

let player: Player | null = null;

export interface TrackInfo {
  title: string;
  url: string;
  author: string;
  duration: string;
  thumbnail?: string;
}

interface ActivePlayerEntry {
  player: ReturnType<typeof createAudioPlayer>;
  connection: ReturnType<typeof joinVoiceChannel>;
  subscription: { unsubscribe: () => void };
  processes: import("child_process").ChildProcess[];
  current: TrackInfo;
  queue: TrackInfo[];
  textChannel?: TextChannel;
  guildId: string;
  adapterCreator: Parameters<typeof joinVoiceChannel>[0]["adapterCreator"];
  voiceChannelId: string;
  startedAt: number;
  progressInterval: ReturnType<typeof setInterval> | null;
  progressMsg: Message | null;
}

const activePlayers = new Map<string, ActivePlayerEntry>();

// ── Persistencia en Base de Datos ─────────────────────────

async function saveQueueToDb(entry: ActivePlayerEntry) {
  const items = [
    {
      guildId: entry.guildId,
      voiceChannelId: entry.voiceChannelId,
      title: entry.current.title,
      url: entry.current.url,
      author: entry.current.author,
      duration: entry.current.duration,
      thumbnail: entry.current.thumbnail ?? null,
      position: 0,
      isCurrent: true,
    },
    ...entry.queue.map((t, i) => ({
      guildId: entry.guildId,
      voiceChannelId: entry.voiceChannelId,
      title: t.title,
      url: t.url,
      author: t.author,
      duration: t.duration,
      thumbnail: t.thumbnail ?? null,
      position: i + 1,
      isCurrent: false,
    })),
  ];

  await prisma.$transaction([
    prisma.musicQueueItem.deleteMany({ where: { guildId: entry.guildId } }),
    prisma.musicQueueItem.createMany({ data: items }),
  ]);
}

async function clearQueueFromDb(guildId: string) {
  await prisma.musicQueueItem.deleteMany({ where: { guildId } });
}

/** Limpia todas las colas huérfanas al iniciar el bot (voice connections no persisten). */
export async function cleanupStaleQueues(): Promise<number> {
  const { count } = await prisma.musicQueueItem.deleteMany({});
  return count;
}

// ───────────────────────────────────────────────────────────

export function getPlayer(): Player | null {
  return player;
}

export function getActivePlayer(guildId: string) {
  return activePlayers.get(guildId);
}

export function stopActivePlayer(guildId: string) {
  const entry = activePlayers.get(guildId);
  if (!entry) return;
  if (entry.progressInterval) clearInterval(entry.progressInterval);
  entry.player.stop();
  for (const cp of entry.processes) {
    if (!cp.killed) cp.kill("SIGTERM");
  }
  entry.processes = [];
  const conn = getVoiceConnection(guildId);
  if (conn) conn.destroy();
  activePlayers.delete(guildId);
  clearQueueFromDb(guildId).catch((err) =>
    logger.warn("Failed to clear queue from DB on stop", { error: String(err) })
  );
}

export function skipToNext(guildId: string): boolean {
  const entry = activePlayers.get(guildId);
  if (!entry || entry.queue.length === 0) return false;

  // Stop the current audio player → triggers AudioPlayerStatus.Idle
  // The Idle handler already picks and plays the next queued track
  entry.player.stop();
  return true;
}

export function setActivePlayerVolume(guildId: string, level: number): boolean {
  const entry = activePlayers.get(guildId);
  if (!entry) return false;
  // Properly typed: when Playing, state includes `resource`
  if (entry.player.state.status === AudioPlayerStatus.Playing && entry.player.state.resource?.volume) {
    entry.player.state.resource.volume.setVolume(level / 100);
    return true;
  }
  return false;
}

export function pauseActivePlayer(guildId: string): boolean {
  const entry = activePlayers.get(guildId);
  if (!entry) return false;
  entry.player.pause();
  return true;
}

export function resumeActivePlayer(guildId: string): boolean {
  const entry = activePlayers.get(guildId);
  if (!entry) return false;
  entry.player.unpause();
  return true;
}

export async function removeFromQueue(guildId: string, position: number): Promise<TrackInfo | null> {
  const entry = activePlayers.get(guildId);
  if (!entry || position < 1 || position > entry.queue.length) return null;
  const removed = entry.queue.splice(position - 1, 1);
  const track = removed[0] || null;
  if (track) {
    await saveQueueToDb(entry).catch((err) =>
      logger.warn("Failed to sync queue to DB after remove", { error: String(err) })
    );
  }
  return track;
}

export function isActivePlayerPaused(guildId: string): boolean {
  const entry = activePlayers.get(guildId);
  if (!entry) return false;
  return entry.player.state.status === AudioPlayerStatus.Paused;
}

async function playNow(entry: ActivePlayerEntry, track: TrackInfo) {
  const { processes: oldProcs } = entry;
  for (const cp of oldProcs) {
    if (!cp.killed) cp.kill("SIGTERM");
  }
  oldProcs.length = 0;

  entry.current = track;

  const dl = ytDlp.exec(track.url, {
    format: "140",
    output: "-",
    noCheckCertificates: true,
    bufferSize: "64K",
  }, { stdio: ["ignore", "pipe", "pipe"] });
  dl.catch((err: unknown) => {
    // yt-dlp killed with SIGTERM is expected — only log non-signal errors
    const msg = String(err);
    if (!msg.includes("killed") && !msg.includes("SIGTERM") && !msg.includes("EPIPE")) {
      logger.warn("yt-dlp error", { error: String(err).slice(0, 200) });
    }
  });

  if (!dl.stdout) throw new Error("yt-dlp stdout is null");

  const ff = spawn(ffmpegPath!, [
    "-i", "-",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1",
  ], { stdio: ["pipe", "pipe", "pipe"] });

  dl.stdout.pipe(ff.stdin!);
  dl.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") logger.error("yt-dlp stdout error", { error: String(err) });
  });
  ff.stdin!.on("error", () => {});

  // Capturar stderr de FFmpeg para diagnóstico (máx 2000 chars)
  let ffStderr = "";
  ff.stderr?.on("data", (chunk: Buffer) => {
    ffStderr = (ffStderr + chunk.toString()).slice(-2000);
  });

  entry.processes = [dl, ff];

  dl.on("exit", () => {
    entry.processes = entry.processes.filter((p) => p !== dl);
  });
  ff.on("exit", (code) => {
    entry.processes = entry.processes.filter((p) => p !== ff);
    // code === null significa que fue matado con señal (SIGTERM esperado)
    if (code !== null && code !== 0 && ffStderr) {
      logger.warn(`FFmpeg exited with code ${code}`, { stderr: ffStderr.slice(-500) });
    }
  });

  // ── Pre-buffer: esperar a que lleguen datos antes de entregar el stream ──
  const pcmStream = ff.stdout!;

  await new Promise<void>((resolve, reject) => {
    let dataReceived = false;
    const timeout = setTimeout(() => {
      if (!dataReceived) {
        logger.warn(`Pre-buffer timeout for ${track.title}, starting anyway`);
      }
      resolve();
    }, 30_000);

    pcmStream.once("data", () => {
      dataReceived = true;
      clearTimeout(timeout);
      resolve();
    });

    pcmStream.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ff.on("exit", (code) => {
      if (!dataReceived && code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`FFmpeg exited with code ${code} before data: ${ffStderr.slice(-200)}`));
      }
    });
  });

  const resource = createAudioResource(pcmStream, {
    inputType: StreamType.Raw,
    inlineVolume: true,
  });

  entry.startedAt = Date.now();
  entry.player.play(resource);
}

export async function playYouTubeStream(
  guildId: string,
  voiceChannelId: string,
  guild: { id: string },
  adapterCreator: Parameters<typeof joinVoiceChannel>[0]["adapterCreator"],
  track: TrackInfo,
  textChannel?: TextChannel,
) {
  const existing = activePlayers.get(guildId);

  // Si ya hay reproducción activa, encolar
  if (existing) {
    existing.queue.push(track);
    existing.textChannel = textChannel || existing.textChannel;
    saveQueueToDb(existing).catch((err) =>
      logger.warn("Failed to sync queue to DB after enqueue", { error: String(err) })
    );
    logger.info(`📋 Queued: ${track.title} (${existing.queue.length} en cola)`);
    return "queued";
  }

  // Crear nueva entrada
  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId: guild.id,
    adapterCreator,
  });

  const audioPlayer = createAudioPlayer();
  const subscription = connection.subscribe(audioPlayer) ?? { unsubscribe: () => {} };

  const entry: ActivePlayerEntry = {
    player: audioPlayer,
    connection,
    subscription,
    processes: [],
    current: track,
    queue: [],
    textChannel,
    guildId,
    adapterCreator,
    voiceChannelId,
    startedAt: Date.now(),
    progressInterval: null,
    progressMsg: null,
  };

  activePlayers.set(guildId, entry);

  // Guardar en DB
  saveQueueToDb(entry).catch((err) =>
    logger.warn("Failed to save queue to DB on start", { error: String(err) })
  );

  // Playing event — envía embed de progreso y lo actualiza cada 10s
  audioPlayer.on(AudioPlayerStatus.Playing, async () => {
    const cur = entry.current;
    logger.info(`🎵 Playing: ${cur.title}`);

    // Limpiar interval anterior por si queda
    if (entry.progressInterval) {
      clearInterval(entry.progressInterval);
      entry.progressInterval = null;
    }

    if (!entry.textChannel) return;

    // Enviar embed inicial
    const embed = buildProgressEmbed(cur, entry.startedAt, entry.queue.length);
    if (cur.thumbnail) embed.setThumbnail(cur.thumbnail);

    try {
      const msg = await entry.textChannel.send({ embeds: [embed] });
      entry.progressMsg = msg;
    } catch {
      logger.warn(`Failed to send progress embed for ${cur.title}`);
      return;
    }

    // Actualizar cada 10 segundos
    entry.progressInterval = setInterval(() => {
      const e = activePlayers.get(guildId);
      if (!e || !e.progressMsg) {
        if (entry.progressInterval) clearInterval(entry.progressInterval);
        entry.progressInterval = null;
        return;
      }
      const updated = buildProgressEmbed(e.current, e.startedAt, e.queue.length);
      if (e.current.thumbnail) updated.setThumbnail(e.current.thumbnail);
      e.progressMsg.edit({ embeds: [updated] }).catch(() => {
        // Si falla (ej. mensaje eliminado), limpiar
        if (entry.progressInterval) clearInterval(entry.progressInterval);
        entry.progressInterval = null;
        entry.progressMsg = null;
      });
    }, 10_000);
  });

  // Idle → reproducir siguiente o terminar
  audioPlayer.on(AudioPlayerStatus.Idle, () => {
    logger.info(`⏹️ Finished: ${entry.current.title}`);

    // Limpiar interval de progreso
    if (entry.progressInterval) {
      clearInterval(entry.progressInterval);
      entry.progressInterval = null;
    }
    entry.progressMsg = null;

    // Limpiar procesos de la canción actual
    for (const cp of entry.processes) {
      if (!cp.killed) cp.kill("SIGTERM");
    }
    entry.processes = [];

    // Siguiente canción en cola
    if (entry.queue.length > 0) {
      const next = entry.queue.shift()!;
      playNow(entry, next).then(() => {
        // Actualizar DB con el nuevo current track
        saveQueueToDb(entry).catch((err) =>
          logger.warn("Failed to sync queue to DB after next track", { error: String(err) })
        );
      }).catch((err) => {
        logger.error(`Error playing next: ${err.message}`);
        stopActivePlayer(guildId);
      });
      return;
    }

    // No hay más canciones → desconectar
    entry.subscription.unsubscribe();
    activePlayers.delete(guildId);
    clearQueueFromDb(guildId).catch((err) =>
      logger.warn("Failed to clear queue from DB on end", { error: String(err) })
    );
    if (entry.textChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setDescription("⏹️ La cola terminó. Desconectando del canal de voz...");
      entry.textChannel.send({ embeds: [embed] }).catch(() => {});
    }
    setTimeout(() => {
      const conn = getVoiceConnection(guildId);
      if (conn) conn.destroy();
    }, 1_000);
  });

  // Error
  audioPlayer.on("error", (err) => {
    logger.error(`Audio player error: ${err.message}`);
    stopActivePlayer(guildId);
  });

  // Iniciar reproducción
  await playNow(entry, track);
  return "playing";
}

// ── Parsear duración "3:45" o "1:23:45" a milisegundos ──
export function parseDurationToMs(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
  return 0;
}

// ── Construir embed de progreso ──
function buildProgressEmbed(cur: TrackInfo, startedAt: number, queueLen: number) {
  const elapsed = Date.now() - startedAt;
  const total = parseDurationToMs(cur.duration);
  const bar = total > 0 ? getProgressBar(elapsed, total) : "▬".repeat(15);
  const elapsedStr = formatDuration(elapsed);
  const totalStr = total > 0 ? formatDuration(total) : cur.duration || "?";
  const queueText = queueLen > 0 ? `${queueLen} canción(es) en cola` : "No hay más canciones";

  return new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle(`🎵 ${cur.title}`)
    .setURL(cur.url || "")
    .setDescription(`\`${bar}\` **${elapsedStr}** / **${totalStr}**`)
    .addFields(
      { name: "👤 Artista", value: cur.author || "Desconocido", inline: true },
      { name: "📋 Cola", value: queueText, inline: true },
    )
    .setTimestamp();
}

// ── discord-player (solo para no-YouTube) ──

export async function initPlayer(client: Client): Promise<Player> {
  if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
    logger.info(`FFMPEG_PATH set to: ${ffmpegPath}`);
  }

  player = new Player(client);

  await player.extractors.loadMulti(DefaultExtractors).catch((err) => {
    logger.error("Failed to load default extractors", { error: String(err) });
  });

  // Limpiar colas huérfanas de ejecuciones anteriores (voice connections no persisten)
  const deleted = await cleanupStaleQueues();
  if (deleted > 0) {
    logger.info(`🧹 Cleaned up ${deleted} stale queue item(s) from DB`);
  }

  player.events.on(GuildQueueEvent.PlayerStart, (queue: GuildQueue, track: Track) => {
    const channel = queue.metadata?.channel as TextChannel | undefined;
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("🎵 Reproduciendo ahora")
        .setDescription(track.url ? `[${track.title}](${track.url})` : track.title)
        .addFields(
          { name: "👤 Artista", value: track.author || "Desconocido", inline: true },
          { name: "⏱ Duración", value: track.duration || "?", inline: true },
        )
        .setFooter({ text: `Solicitado por ${track.requestedBy?.username || "Alguien"}` })
        .setTimestamp();
      if (track.thumbnail) embed.setThumbnail(track.thumbnail);
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  });

  player.events.on(GuildQueueEvent.EmptyQueue, (queue: GuildQueue) => {
    const channel = queue.metadata?.channel as TextChannel | undefined;
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setDescription("⏹️ La cola terminó. Desconectando del canal de voz...");
      channel.send({ embeds: [embed] }).catch(() => {});
    }    setTimeout(() => {
      try { queue.delete(); } catch {
        logger.debug("Failed to delete discord-player queue (already cleaned up)");
      }
    }, 30_000);

  });

  player.events.on(GuildQueueEvent.Error, (queue: GuildQueue, error: Error) => {
    if ((error as NodeJS.ErrnoException).code === "EPIPE" || error.message.includes("EPIPE")) return;
    logger.error(`Player error in guild ${queue.guild.id}`, { error: String(error) });
  });

  return player;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function getProgressBar(current: number, total: number, length = 15): string {
  if (total <= 0) return "▬".repeat(length);
  const p = Math.min(Math.floor((current / total) * length), length);
  return "▰".repeat(p) + "▬".repeat(length - p);
}
