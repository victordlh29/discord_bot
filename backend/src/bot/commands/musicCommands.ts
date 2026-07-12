import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
  TextChannel,
} from "discord.js";
import { getPlayer, getProgressBar, formatDuration, playYouTubeStream, stopActivePlayer, getActivePlayer, skipToNext, setActivePlayerVolume, pauseActivePlayer, resumeActivePlayer, isActivePlayerPaused, parseDurationToMs, removeFromQueue } from "../../modules/music/service";
import { logger } from "../../core/utils/logger";
import ytSearch from "yt-search";

interface SearchResult {
  title: string;
  author: string;
  duration: string;
  url: string;
  thumbnail: string | null;
  views: number;
}

function makeUrl(videoId: string) {
  return `https://youtube.com/watch?v=${videoId}`;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function searchYt(query: string): Promise<SearchResult[]> {
  try {
    const result = await ytSearch(query);
    return result.videos.slice(0, 20).map((v) => ({
      title: v.title,
      author: v.author?.name || "?",
      duration: v.timestamp || "?",
      url: makeUrl(v.videoId),
      thumbnail: v.thumbnail || null,
      views: v.views || 0,
    }));
  } catch {
    return [];
  }
}

// ── /play ──────────────────────────────────────────────

export const playCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Buscar y reproducir una canción desde YouTube")
    .addStringOption((opt) =>
      opt.setName("query")
        .setDescription("Nombre de la canción o URL")
        .setRequired(true)
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    if (!(interaction.member instanceof GuildMember)) return;

    const query = interaction.options.getString("query", true);
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: "❌ Tenés que estar en un canal de voz.", ephemeral: true });
      return;
    }

    const player = getPlayer();
    if (!player) {
      await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // URL directa
      if (/^https?:\/\//.test(query)) {
        const videoId = extractVideoId(query);
        if (videoId) {
          const url = makeUrl(videoId);
          const items = await searchYt(url);
          if (items.length > 0) {
            const sel = items[0];
            await interaction.editReply({ content: `⏳ Reproduciendo **${sel.title}**...` });
            await playYouTubeStream(
              interaction.guildId!,
              voiceChannel.id,
              interaction.guild!,
              interaction.guild!.voiceAdapterCreator,
              { title: sel.title, url: sel.url, author: sel.author, duration: sel.duration, thumbnail: sel.thumbnail ?? undefined },
              interaction.channel as TextChannel,
            );
            return;
          }
        }
        // No es YouTube − discord-player
        const { track } = await player.play(voiceChannel, query, {
          nodeOptions: {
            metadata: { channel: interaction.channel, requestedBy: interaction.user },
            leaveOnEnd: false, leaveOnStop: false, leaveOnEmptyCooldown: 30_000,
            bufferingTimeout: 15_000, volume: 50,
          },
        });
        const embed = new EmbedBuilder()
          .setColor(0x1db954)
          .setTitle("🎵 Añadido a la cola")
          .setDescription(track.url ? `[${track.title}](${track.url})` : track.title)
          .addFields(
            { name: "👤 Artista", value: track.author || "Desconocido", inline: true },
            { name: "⏱ Duración", value: track.duration || "?", inline: true },
          );
        if (track.thumbnail) embed.setThumbnail(track.thumbnail);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // ── Búsqueda ──
      const items = await searchYt(query);
      if (items.length === 0) {
        await interaction.editReply({ content: "❌ No se encontraron resultados." });
        return;
      }

      const previewCount = Math.min(items.length, 10);
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`🔍 Resultados para "${query}"`)
        .setDescription(
          items.slice(0, previewCount).map((r, i) =>
            `**${i + 1}.** [${r.title}](${r.url}) — ${r.author} [${r.duration}]`
          ).join("\n") + (items.length > previewCount ? `\n\n*... y ${items.length - previewCount} más en el menú*` : "")
        )
        .setFooter({ text: `🎵 ${items.length} resultados — Seleccioná una del menú` });

      const select = new StringSelectMenuBuilder()
        .setCustomId("track-select")
        .setPlaceholder("🎵 Elegí una canción...")
        .addOptions(
          items.map((r, i) => {
            const desc = `${r.author} — ${r.duration}`;
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${i + 1}. ${r.title.slice(0, 80)}`)
              .setDescription(desc.length > 97 ? desc.slice(0, 97) + "..." : desc)
              .setValue(String(i));
          })
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      const response = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (si) => {
        if (!si.isStringSelectMenu()) return;
        const idx = parseInt(si.values[0], 10);
        const selected = items[idx];
        if (!selected) {
          await si.update({ content: "❌ Error al seleccionar.", embeds: [], components: [] });
          return;
        }

        await si.update({ content: `⏳ Reproduciendo **${selected.title}**...`, embeds: [], components: [] });

        try {
          // Reproducir directamente con yt-dlp + FFmpeg + @discordjs/voice
          await playYouTubeStream(
            interaction.guildId!,
            voiceChannel.id,
            interaction.guild!,
            interaction.guild!.voiceAdapterCreator,
            { title: selected.title, url: selected.url, author: selected.author, duration: selected.duration, thumbnail: selected.thumbnail ?? undefined },
            interaction.channel as TextChannel,
          );

          // El embed de "Reproduciendo ahora" lo envía el evento Playing
          await si.editReply({ content: `✅ **${selected.title}** añadida a la reproducción.`, embeds: [] });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Error desconocido";
          logger.warn(`Error al reproducir: ${msg}`);
          await si.editReply({ content: `❌ Error: \`${msg.slice(0, 200)}\``, embeds: [] });
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try { await interaction.editReply({ content: "⏱️ Tiempo agotado. Usá `/play` de nuevo.", embeds: [], components: [] }); } catch { /* ok */ }
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      logger.warn(`Error en /play: ${msg}`);
      await interaction.editReply({ content: `❌ Error: \`${msg.slice(0, 200)}\`` });
    }
  },
};

// ── /skip ──────────────────────────────────────────────

export const skipCommand = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Saltar a la siguiente canción"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Reproducción directa: saltar a la siguiente en cola
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      if (active.queue.length > 0) {
        const next = active.queue[0];
        skipToNext(interaction.guildId!);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription(`⏭️ Saltada. → **${next.title}**`)] });
      } else {
        stopActivePlayer(interaction.guildId!);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("⏭️ Saltada. No hay más canciones en cola.")] });
      }
      return;
    }

    const player = getPlayer();
    if (!player) {
      await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });
      return;
    }
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.reply({ content: "❌ No hay nada reproduciéndose.", ephemeral: true });
      return;
    }
    queue.node.skip();
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("⏭️ Saltada.")] });
  },
};

// ── /stop ──────────────────────────────────────────────

export const stopCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Detener y limpiar la cola"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Primero intentar detener reproducción directa (YouTube)
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      stopActivePlayer(interaction.guildId!);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("⏹️ Detenido.")] });
      return;
    }

    // Si no, intentar con discord-player
    const player = getPlayer();
    if (!player) {
      await interaction.reply({ content: "❌ No hay reproducción activa.", ephemeral: true });
      return;
    }
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue) {
      await interaction.reply({ content: "❌ No hay reproducción activa.", ephemeral: true });
      return;
    }
    queue.delete();
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("⏹️ Detenido.")] });
  },
};

// ── /queue ─────────────────────────────────────────────

export const queueCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Ver la cola de reproducción"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      const total = active.queue.length + 1;
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🎶 Cola directa — ${total} canción(es)`)
        .addFields({ name: "▶️ Ahora", value: `[${active.current.title}](${active.current.url || ""}) — ${active.current.author} [${active.current.duration}]` });

      if (active.queue.length > 0) {
        embed.addFields({
          name: "⏭️ Siguientes",
          value: active.queue.slice(0, 10).map((t, i) =>
            `**${i + 1}.** [${t.title}](${t.url || ""}) — ${t.author} [${t.duration}]`
          ).join("\n"),
        });
        if (active.queue.length > 10) embed.setFooter({ text: `Y ${active.queue.length - 10} más...` });
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Discord-player
    const player = getPlayer();
    if (!player) return void await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });

    const queue = player.nodes.get(interaction.guildId!);
    if (!queue?.isPlaying()) return void await interaction.reply({ content: "❌ No hay nada reproduciéndose.", ephemeral: true });

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray();

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎶 Cola — ${tracks.length + 1} canción(es)`);

    if (current) {
      const prog = queue.node.getTimestamp();
      const bar = prog ? getProgressBar(prog.current.value, prog.total.value) : "▬".repeat(15);
      const t = prog ? `${formatDuration(prog.current.value)} / ${formatDuration(prog.total.value)}` : "";
      embed.addFields({ name: "▶️ Ahora", value: `[${current.title}](${current.url || ""})\n\`${bar}\` ${t}` });
    }

    if (tracks.length > 0) {
      embed.addFields({
        name: "⏭️ Siguientes",
        value: tracks.slice(0, 10).map((t, i) =>
          `**${i + 1}.** [${t.title}](${t.url || ""}) — ${t.author || "?"} [${t.duration || "?"}]`
        ).join("\n"),
      });
      if (tracks.length > 10) embed.setFooter({ text: `Y ${tracks.length - 10} más...` });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

// ── /pause ─────────────────────────────────────────────

export const pauseCommand = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pausar la reproducción"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      if (isActivePlayerPaused(interaction.guildId!)) {
        return void await interaction.reply({ content: "⚠️ Ya está pausada.", ephemeral: true });
      }
      pauseActivePlayer(interaction.guildId!);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("⏸️ Pausada.")] });
      return;
    }

    const player = getPlayer();
    if (!player) return void await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });

    const queue = player.nodes.get(interaction.guildId!);
    if (!queue?.isPlaying()) return void await interaction.reply({ content: "❌ No hay nada reproduciéndose.", ephemeral: true });
    if (queue.node.isPaused()) return void await interaction.reply({ content: "⚠️ Ya está pausada.", ephemeral: true });

    queue.node.setPaused(true);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription("⏸️ Pausada.")] });
  },
};

// ── /resume ────────────────────────────────────────────

export const resumeCommand = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Reanudar la reproducción"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      if (isActivePlayerPaused(interaction.guildId!)) {
        return void await interaction.reply({ content: "⚠️ No está pausada.", ephemeral: true });
      }
      resumeActivePlayer(interaction.guildId!);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription("▶️ Reanudada.")] });
      return;
    }

    const player = getPlayer();
    if (!player) return void await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });

    const queue = player.nodes.get(interaction.guildId!);
    if (!queue?.isPlaying()) return void await interaction.reply({ content: "❌ No hay nada reproduciéndose.", ephemeral: true });
    if (!queue.node.isPaused()) return void await interaction.reply({ content: "⚠️ No está pausada.", ephemeral: true });

    queue.node.setPaused(false);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription("▶️ Reanudada.")] });
  },
};

// ── /nowplaying ────────────────────────────────────────

export const nowplayingCommand = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Ver la canción actual"),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      const elapsed = Date.now() - active.startedAt;
      const total = parseDurationToMs(active.current.duration);
      const bar = total > 0 ? getProgressBar(elapsed, total) : "▬".repeat(15);
      const elapsedStr = formatDuration(elapsed);
      const totalStr = total > 0 ? formatDuration(total) : active.current.duration || "?";

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(`🎵 ${active.current.title}`)
        .setURL(active.current.url || "")
        .setDescription(`\`${bar}\` **${elapsedStr}** / **${totalStr}**`)
        .addFields(
          { name: "👤 Artista", value: active.current.author || "Desconocido", inline: true },
          { name: "📋 Cola", value: `${active.queue.length} canción(es) pendiente(s)`, inline: true },
        );
      if (active.current.thumbnail) embed.setThumbnail(active.current.thumbnail);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const player = getPlayer();
    if (!player) return void await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });

    const queue = player.nodes.get(interaction.guildId!);
    if (!queue?.isPlaying() || !queue.currentTrack) {
      return void await interaction.reply({ content: "❌ No hay nada reproduciéndose.", ephemeral: true });
    }

    const track = queue.currentTrack;
    const prog = queue.node.getTimestamp();
    const bar = prog ? getProgressBar(prog.current.value, prog.total.value) : "▬".repeat(15);
    const t = prog ? `${formatDuration(prog.current.value)} / ${formatDuration(prog.total.value)}` : "";

    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle(`🎵 ${track.title}`)
      .setURL(track.url || "")
      .addFields(
        { name: "👤 Artista", value: track.author || "Desconocido", inline: true },
        { name: "⏱ Duración", value: track.duration || "? : ?", inline: true },
        { name: "📊 Progreso", value: `\`${bar}\` ${t}` },
        { name: "🙋 Solicitado por", value: track.requestedBy?.username || "Alguien", inline: true },
      );
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    await interaction.reply({ embeds: [embed] });
  },
};

// ── /volume ────────────────────────────────────────────

export const volumeCommand = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Ajustar el volumen (0-100)")
    .addIntegerOption((opt) =>
      opt.setName("nivel").setDescription("Volumen").setRequired(true).setMinValue(0).setMaxValue(100)
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const level = interaction.options.getInteger("nivel", true);
    
    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      const ok = setActivePlayerVolume(interaction.guildId!, level);
      if (!ok) {
        await interaction.reply({ content: "⚠️ No se pudo ajustar el volumen en este momento.", ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setDescription(`🔊 Volumen: **${level}%**`)] });
      return;
    }

    const player = getPlayer();
    if (!player) {
      await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });
      return;
    }
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue) {
      await interaction.reply({ content: "❌ No hay reproducción activa.", ephemeral: true });
      return;
    }
    queue.node.setVolume(level);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setDescription(`🔊 Volumen: **${level}%**`)] });
  },
};

// ── /remove ────────────────────────────────────────────

export const removeCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Quitar una canción de la cola por su número")
    .addIntegerOption((opt) =>
      opt.setName("posicion")
        .setDescription("N° de la canción en la cola (mirá /queue)")
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    const position = interaction.options.getInteger("posicion", true);

    // Reproducción directa
    const active = getActivePlayer(interaction.guildId!);
    if (active) {
      const removed = await removeFromQueue(interaction.guildId!, position);
      if (!removed) {
        await interaction.reply({
          content: `❌ Posición inválida. La cola tiene **${active.queue.length}** canciones (usá 1-${active.queue.length}).`,
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setDescription(`🗑️ Eliminada: **${removed.title}** — ${removed.author}`)
        ],
      });
      return;
    }

    // Discord-player
    const player = getPlayer();
    if (!player) {
      await interaction.reply({ content: "❌ Reproductor no disponible.", ephemeral: true });
      return;
    }
    const queue = player.nodes.get(interaction.guildId!);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply({ content: "❌ No hay reproducción activa.", ephemeral: true });
      return;
    }

    const tracks = queue.tracks.toArray();
    if (position < 1 || position > tracks.length) {
      await interaction.reply({
        content: `❌ Posición inválida. La cola tiene **${tracks.length}** canciones (usá 1-${tracks.length}).`,
        ephemeral: true,
      });
      return;
    }

    const removed = tracks[position - 1];
    queue.node.remove(removed);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`🗑️ Eliminada: **${removed.title}** — ${removed.author || "?"}`)
      ],
    });
  },
};
