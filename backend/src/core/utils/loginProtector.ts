/**
 * LoginProtector — Protección contra fuerza bruta en login de admin.
 *
 * Almacena intentos fallidos por IP en memoria y bloquea la IP
 * después de N intentos fallidos por un período configurable.
 *
 * Las variables de entorno disponibles:
 *   ADMIN_LOGIN_MAX_ATTEMPTS=5      (intentos antes del bloqueo)
 *   ADMIN_LOGIN_BLOCK_MINUTES=60    (duración del bloqueo)
 */

import { logger } from "./logger";

interface IpRecord {
  count: number;
  blockedUntil: number | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BLOCK_MINUTES = 60;

class LoginProtector {
  private attempts: Map<string, IpRecord>;
  private maxAttempts: number;
  private blockDurationMs: number;

  constructor(maxAttempts?: number, blockDurationMinutes?: number) {
    this.attempts = new Map();
    this.maxAttempts = maxAttempts ?? parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || String(DEFAULT_MAX_ATTEMPTS), 10);
    this.blockDurationMs =
      (blockDurationMinutes ?? parseInt(process.env.ADMIN_LOGIN_BLOCK_MINUTES || String(DEFAULT_BLOCK_MINUTES), 10)) *
      60 *
      1000;

    // Limpieza periódica cada 10 minutos para evitar memory leak
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Registra un intento fallido desde una IP.
   * Si alcanza el límite, bloquea la IP.
   */
  recordFailure(ip: string): void {
    const now = Date.now();
    let record = this.attempts.get(ip);

    if (!record || (record.blockedUntil && now >= record.blockedUntil)) {
      record = { count: 0, blockedUntil: null };
    }

    record.count += 1;

    if (record.count >= this.maxAttempts) {
      record.blockedUntil = now + this.blockDurationMs;
      logger.warn(`🔒 IP bloqueada por intentos fallidos: ${ip} (${record.count} intentos, bloqueado hasta ${new Date(record.blockedUntil).toISOString()})`);
    }

    this.attempts.set(ip, record);
  }

  /**
   * Registra un intento exitoso — resetea el contador de la IP.
   */
  recordSuccess(ip: string): void {
    this.attempts.delete(ip);
  }

  /**
   * Verifica si una IP está bloqueada actualmente.
   */
  isBlocked(ip: string): boolean {
    const record = this.attempts.get(ip);
    if (!record || !record.blockedUntil) return false;

    if (Date.now() >= record.blockedUntil) {
      // El bloqueo expiró, limpiar
      this.attempts.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Devuelve los intentos restantes antes del bloqueo.
   * Retorna -1 si ya está bloqueado.
   */
  getRemainingAttempts(ip: string): number {
    const record = this.attempts.get(ip);
    if (!record) return this.maxAttempts;

    if (record.blockedUntil) {
      if (Date.now() >= record.blockedUntil) {
        this.attempts.delete(ip);
        return this.maxAttempts;
      }
      return -1; // Bloqueado
    }

    return Math.max(0, this.maxAttempts - record.count);
  }

  /**
   * Devuelve el tiempo restante de bloqueo en segundos, o 0 si no está bloqueado.
   */
  getBlockTimeRemaining(ip: string): number {
    const record = this.attempts.get(ip);
    if (!record || !record.blockedUntil) return 0;

    const remaining = record.blockedUntil - Date.now();
    if (remaining <= 0) {
      this.attempts.delete(ip);
      return 0;
    }

    return Math.ceil(remaining / 1000);
  }

  /**
   * Limpia registros expirados para evitar memory leak.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [ip, record] of this.attempts.entries()) {
      if (record.blockedUntil && now >= record.blockedUntil) {
        this.attempts.delete(ip);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`LoginProtector cleanup: ${cleaned} registros expirados eliminados`);
    }
  }
}

// Singleton
export const loginProtector = new LoginProtector();
