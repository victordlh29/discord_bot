const MAX_SAFE_XP = 10n ** 15n;

export function calculateLevel(xp: bigint): number {
  if (xp > MAX_SAFE_XP) xp = MAX_SAFE_XP;
  if (xp < 0n) xp = 0n;
  return Math.floor(Math.sqrt(Number(xp) / 100)) + 1;
}

function xpForLevel(level: number): bigint {
  const safeLevel = Math.min(level, 10_000_000);
  return BigInt(Math.pow(safeLevel - 1, 2) * 100);
}

export function xpToNextLevel(currentXp: bigint, currentLevel: number): bigint {
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}

export function progressToNextLevel(currentXp: bigint, currentLevel: number): number {
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInLevel = Number(currentXp - currentLevelXp);
  const xpRequired = Number(nextLevelXp - currentLevelXp);
  if (xpRequired <= 0) return 1;
  return Math.min(xpInLevel / xpRequired, 1);
}

function sanitizeMessage(content: string): string {
  return content.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

export function isSpam(content: string): boolean {
  const cleaned = sanitizeMessage(content);
  if (cleaned.length < 5) return true;
  const emojiRegex = /^[\p{Emoji}\s]+$/u;
  if (emojiRegex.test(cleaned)) return true;
  const specialCharRegex = /^[^\p{L}\p{N}\s]+$/u;
  if (specialCharRegex.test(cleaned)) return true;
  const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const unique = new Set(words);
    if (unique.size <= 2) return true;
  }
  return false;
}

/** Comprueba si el contenido contiene palabras bloqueadas */
export function hasBlockedWords(content: string, blockedWordsList: string[]): boolean {
  if (blockedWordsList.length === 0) return false;
  const lower = content.toLowerCase();
  return blockedWordsList.some((word) => {
    if (!word) return false;
    return lower.includes(word.toLowerCase());
  });
}

/** Detecta si un mensaje es copia exacta del último mensaje del usuario */
export function isRepeatedMessage(currentContent: string, lastContent: string | null | undefined): boolean {
  if (!lastContent) return false;
  return currentContent.trim().toLowerCase() === lastContent.trim().toLowerCase();
}

/** @internal */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Valida que un string sea un snowflake de Discord (ID numérico de 17-19 dígitos) */
export function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}
