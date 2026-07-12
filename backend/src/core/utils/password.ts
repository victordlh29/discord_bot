import bcrypt from "bcrypt";
import { logger } from "./logger";

const SALT_ROUNDS = 12;

/**
 * Hashea una contraseña con bcrypt.
 * @param password - Contraseña en texto plano
 * @returns Hash de la contraseña
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra un hash de bcrypt.
 * @param password - Contraseña en texto plano
 * @param hash - Hash de bcrypt almacenado
 * @returns true si la contraseña coincide
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    logger.warn("Error verifying password — el hash puede no ser válido");
    return false;
  }
}

/**
 * Verifica si un string parece un hash de bcrypt válido.
 * Los hashes de bcrypt comienzan con "$2a$", "$2b$" o "$2y$" seguido del costo.
 */
export function isBcryptHash(str: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(str);
}
