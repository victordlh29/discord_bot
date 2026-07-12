import { describe, it, expect } from "vitest";

// ─── Pure logic replicated from music/service.ts ───

interface TrackInfo {
  title: string;
  url: string;
  author: string;
  duration: string;
  thumbnail?: string;
}

interface QueueItem {
  guildId: string;
  voiceChannelId: string;
  title: string;
  url: string;
  author: string;
  duration: string;
  thumbnail: string | null;
  position: number;
  isCurrent: boolean;
}

interface ActivePlayerEntryReplica {
  guildId: string;
  voiceChannelId: string;
  current: TrackInfo;
  queue: TrackInfo[];
}

function buildQueueItems(entry: ActivePlayerEntryReplica): QueueItem[] {
  return [
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
}

// ════════════════════════════════════════════════════════════
//  buildQueueItems — Current Track
// ════════════════════════════════════════════════════════════

describe("buildQueueItems — current track", () => {
  const baseEntry: ActivePlayerEntryReplica = {
    guildId: "guild_001",
    voiceChannelId: "voice_001",
    current: {
      title: "Bohemian Rhapsody",
      url: "https://youtube.com/watch?v=abc123",
      author: "Queen",
      duration: "5:55",
    },
    queue: [],
  };

  it("should set current track at position 0 with isCurrent: true", () => {
    const items = buildQueueItems(baseEntry);
    expect(items).toHaveLength(1);
    expect(items[0].position).toBe(0);
    expect(items[0].isCurrent).toBe(true);
  });

  it("should copy current track title, url, author, duration correctly", () => {
    const items = buildQueueItems(baseEntry);
    expect(items[0].title).toBe("Bohemian Rhapsody");
    expect(items[0].url).toBe("https://youtube.com/watch?v=abc123");
    expect(items[0].author).toBe("Queen");
    expect(items[0].duration).toBe("5:55");
  });

  it("should copy guildId and voiceChannelId", () => {
    const items = buildQueueItems(baseEntry);
    expect(items[0].guildId).toBe("guild_001");
    expect(items[0].voiceChannelId).toBe("voice_001");
  });

  it("should set thumbnail to null when current track has no thumbnail", () => {
    const items = buildQueueItems(baseEntry);
    expect(items[0].thumbnail).toBeNull();
  });

  it("should pass thumbnail value when current has thumbnail", () => {
    const entry: ActivePlayerEntryReplica = {
      ...baseEntry,
      current: { ...baseEntry.current, thumbnail: "https://img.yt/abc.jpg" },
    };
    const items = buildQueueItems(entry);
    expect(items[0].thumbnail).toBe("https://img.yt/abc.jpg");
  });

  it("should convert undefined thumbnail to null, but pass empty string through", () => {
    const entry: ActivePlayerEntryReplica = {
      ...baseEntry,
      current: { ...baseEntry.current, thumbnail: undefined },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00", thumbnail: "" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[0].thumbnail).toBeNull(); // undefined → ?? operator → null
    expect(items[1].thumbnail).toBe(""); // empty string passes through
  });

  it("should handle current track with empty title", () => {
    const entry: ActivePlayerEntryReplica = {
      ...baseEntry,
      current: { title: "", url: "", author: "", duration: "0:00" },
    };
    const items = buildQueueItems(entry);
    expect(items[0].title).toBe("");
    expect(items[0].position).toBe(0);
    expect(items[0].isCurrent).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
//  buildQueueItems — Queued Tracks
// ════════════════════════════════════════════════════════════

describe("buildQueueItems — queued tracks", () => {
  it("should return only current track when queue is empty", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [],
    };
    const items = buildQueueItems(entry);
    expect(items).toHaveLength(1);
  });

  it("should assign positions 1, 2, 3... to queued tracks", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
        { title: "Song C", url: "https://youtube.com/watch?v=c", author: "Artist C", duration: "5:00" },
        { title: "Song D", url: "https://youtube.com/watch?v=d", author: "Artist D", duration: "6:00" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items).toHaveLength(4); // 1 current + 3 queued
    expect(items[0].position).toBe(0);
    expect(items[1].position).toBe(1);
    expect(items[2].position).toBe(2);
    expect(items[3].position).toBe(3);
  });

  it("should mark queued tracks as isCurrent: false", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[0].isCurrent).toBe(true);
    expect(items[1].isCurrent).toBe(false);
  });

  it("should set thumbnail to null for queued tracks without thumbnail", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[1].thumbnail).toBeNull();
  });

  it("should pass thumbnail value for queued tracks that have one", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00", thumbnail: "https://img.yt/b.jpg" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[1].thumbnail).toBe("https://img.yt/b.jpg");
  });

  it("should handle a large queue (20 tracks)", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: Array.from({ length: 20 }, (_, i) => ({
        title: `Song ${i + 1}`,
        url: `https://youtube.com/watch?v=${i}`,
        author: `Artist ${i + 1}`,
        duration: `${i + 2}:00`,
      })),
    };
    const items = buildQueueItems(entry);
    expect(items).toHaveLength(21);
    expect(items[20].position).toBe(20);
    expect(items[20].title).toBe("Song 20");
  });

  it("should preserve track data integrity for queued tracks", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Stairway to Heaven", url: "https://youtube.com/watch?v=ledzep", author: "Led Zeppelin", duration: "8:02" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[1].title).toBe("Stairway to Heaven");
    expect(items[1].url).toBe("https://youtube.com/watch?v=ledzep");
    expect(items[1].author).toBe("Led Zeppelin");
    expect(items[1].duration).toBe("8:02");
  });
});

// ════════════════════════════════════════════════════════════
//  buildQueueItems — Mixed Scenarios
// ════════════════════════════════════════════════════════════

describe("buildQueueItems — mixed scenarios", () => {
  it("should handle current with thumbnail and queued without", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00", thumbnail: "https://img.yt/a.jpg" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
        { title: "Song C", url: "https://youtube.com/watch?v=c", author: "Artist C", duration: "5:00", thumbnail: "https://img.yt/c.jpg" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[0].thumbnail).toBe("https://img.yt/a.jpg");
    expect(items[1].thumbnail).toBeNull();
    expect(items[2].thumbnail).toBe("https://img.yt/c.jpg");
  });

  it("should handle special characters in fields", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Qué será, será", url: "https://youtube.com/watch?v=espanol", author: "José & María", duration: "3:30" },
      queue: [
        { title: "Straße / Street", url: "https://youtube.com/watch?v=german", author: "Ä Ö Ü", duration: "4:15" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[0].title).toBe("Qué será, será");
    expect(items[0].author).toBe("José & María");
    expect(items[1].title).toBe("Straße / Street");
    expect(items[1].author).toBe("Ä Ö Ü");
  });

  it("should handle guildId with special characters", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "123456789012345678",
      voiceChannelId: "876543210987654321",
      current: { title: "Test", url: "https://youtube.com/watch?v=test", author: "Tester", duration: "1:00" },
      queue: [
        { title: "Test 2", url: "https://youtube.com/watch?v=test2", author: "Tester2", duration: "2:00" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items[0].guildId).toBe("123456789012345678");
    expect(items[0].voiceChannelId).toBe("876543210987654321");
    expect(items[1].guildId).toBe("123456789012345678");
    expect(items[1].voiceChannelId).toBe("876543210987654321");
  });

  it("should handle very long URLs", () => {
    const longUrl = "https://youtube.com/watch?v=" + "a".repeat(100);
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Long URL Song", url: longUrl, author: "Artist", duration: "3:00" },
      queue: [],
    };
    const items = buildQueueItems(entry);
    expect(items[0].url).toBe(longUrl);
    expect(items[0].url.length).toBeGreaterThan(100);
  });
});

// ════════════════════════════════════════════════════════════
//  buildQueueItems — Return Value Integrity
// ════════════════════════════════════════════════════════════

describe("buildQueueItems — return value integrity", () => {
  it("should return a new array (not mutate input)", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
      ],
    };
    const items = buildQueueItems(entry);
    expect(items).not.toBe(entry.queue); // Different reference
    expect(entry.queue).toHaveLength(1); // Original queue unchanged
  });

  it("should have all required fields in every item", () => {
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: { title: "Song A", url: "https://youtube.com/watch?v=a", author: "Artist A", duration: "3:00" },
      queue: [
        { title: "Song B", url: "https://youtube.com/watch?v=b", author: "Artist B", duration: "4:00" },
      ],
    };
    const items = buildQueueItems(entry);
    for (const item of items) {
      expect(item).toHaveProperty("guildId");
      expect(item).toHaveProperty("voiceChannelId");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("author");
      expect(item).toHaveProperty("duration");
      expect(item).toHaveProperty("thumbnail");
      expect(item).toHaveProperty("position");
      expect(item).toHaveProperty("isCurrent");
    }
  });

  it("should not mutate the original track objects", () => {
    const track: TrackInfo = { title: "Song", url: "https://youtube.com/watch?v=s", author: "Artist", duration: "3:00" };
    const entry: ActivePlayerEntryReplica = {
      guildId: "guild_001",
      voiceChannelId: "voice_001",
      current: track,
      queue: [{ ...track, title: "Song 2" }],
    };
    const items = buildQueueItems(entry);
    items[0].title = "MODIFIED";
    items[1].title = "MODIFIED";
    expect(track.title).toBe("Song");
    expect(entry.queue[0].title).toBe("Song 2");
  });
});
