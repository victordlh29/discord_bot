import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── In-memory cache fallback ──────────────────────────────────────────
// Usada cuando Redis no está disponible (Docker no instalado)
interface MemCacheEntry {
  data: string;
  expiresAt: number;
}

const memCache = new Map<string, MemCacheEntry>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.data) as T;
  } catch {
    return null;
  }
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  memCache.set(key, {
    data: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memDel(key: string): void {
  memCache.delete(key);
}

// ── Redis connection ───────────────────────────────────────────────────

let redis: Redis | null = null;
let redisAvailable = false;
let lastRetryTime = 0;
const RETRY_INTERVAL = 30_000; // 30s entre reintentos si Redis no está disponible

/** Intenta conectar a Redis. Se llama al cargar el módulo y en cada reintento. */
function connectRedis(): void {
  if (redisAvailable) return;
  if (redis) return;
  if (Date.now() - lastRetryTime < RETRY_INTERVAL) return;
  lastRetryTime = Date.now();
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy() {
        return null;
      },
      connectTimeout: 3000,
    });

    redis.on("error", () => {
      redisAvailable = false;
    });

    redis.on("ready", () => {
      redisAvailable = true;
      logger.info("Redis connected");
    });
  } catch {
    redis = null;
  }
}

// Eager connect: intenta conectar en cuanto se importa el módulo
connectRedis();

function shouldTryRedis(): boolean {
  if (redisAvailable) return true;
  if (redis) return true;
  return Date.now() - lastRetryTime > RETRY_INTERVAL;
}

function getRedis(): Redis | null {
  if (redisAvailable) return redis;
  if (redis) return redis;
  // No reintentar más seguido que RETRY_INTERVAL
  if (Date.now() - lastRetryTime < RETRY_INTERVAL) return null;
  connectRedis();
  return redis;
}

// ── Public API ────────────────────────────────────────────────────────

/** Destruye la instancia de Redis para que se reintente la conexión */
function destroyRedis(): void {
  try {
    redis?.disconnect();
  } catch {
    // ignore
  }
  redis = null;
  redisAvailable = false;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // 1. Intentar Redis (si debe reintentar)
  if (shouldTryRedis()) {
    try {
      const r = getRedis();
      if (r) {
        const data = await r.get(key);
        if (data) return JSON.parse(data) as T;
      }
    } catch {
      destroyRedis();
    }
  }
  // 2. Fallback: in-memory cache
  return memGet<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  // 1. Guardar en in-memory (siempre funciona)
  memSet(key, value, ttlSeconds);
  // 2. Intentar Redis (best-effort, no bloqueante)
  if (shouldTryRedis()) {
    try {
      const r = getRedis();
      if (r) await r.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      destroyRedis();
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  // 1. Limpiar in-memory
  memDel(key);
  // 2. Intentar Redis
  if (shouldTryRedis()) {
    try {
      const r = getRedis();
      if (r) await r.del(key);
    } catch {
      destroyRedis();
    }
  }
}
