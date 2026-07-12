/** Detecta si una URL es una página web (Tenor, MakeAGIF) en vez de un GIF directo */
export function isPageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const isKnownPageDomain = /(tenor\.com|makeagif\.com)/i.test(u.hostname);
    const hasPagePattern = /(\/view\/|\/gif\/)/i.test(u.pathname);
    const isDirectImage = /\.(gif|webp|png|jpg|jpeg|mp4|webm)([?#]|$)/i.test(url);
    return isKnownPageDomain && hasPagePattern && !isDirectImage;
  } catch {
    return false;
  }
}

/** Detecta si una URL apunta directamente a un archivo de imagen/GIF */
export function isDirectImageUrl(url: string): boolean {
  try {
    new URL(url);
    return /\.(gif|webp|png|jpg|jpeg|mp4|webm)([?#]|$)/i.test(url) && !isPageUrl(url);
  } catch {
    return false;
  }
}

export type GifEntryType = "direct" | "page" | "unknown" | "invalid";

export interface GifEntry {
  type: GifEntryType;
  url: string;
  label: string;
  icon: string;
}

/** Normaliza URLs para que funcionen en embeds de Discord */
export function normalizeGifUrl(url: string): string {
  // Tenor: extraer ID y construir URL directa
  const tenorMatch = url.match(/tenor\.com\/m\/(\w+)/);
  if (tenorMatch) {
    return `https://media.tenor.com/${tenorMatch[1]}/tenor.gif`;
  }
  // GIPHY: extraer ID de URLs largas con API params
  const giphyMatch = url.match(/media\d?\.giphy\.com\/media\/.*\/(\w+)\/giphy\.gif/);
  if (giphyMatch) {
    return `https://i.giphy.com/${giphyMatch[1]}.gif`;
  }
  return url;
}

/** Clasifica una URL en directa, página web, desconocida o inválida */
export function classifyUrl(url: string): GifEntry | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    new URL(trimmed);
  } catch {
    return { type: "invalid", url: trimmed, label: "URL inválida", icon: "❌" };
  }
  if (isPageUrl(trimmed)) return { type: "page", url: trimmed, label: "Página web", icon: "🔗" };
  if (isDirectImageUrl(trimmed)) {
    const normalized = normalizeGifUrl(trimmed);
    const changed = normalized !== trimmed;
    return { type: "direct", url: normalized, label: changed ? "GIF directo (normalizado)" : "GIF directo", icon: "✅" };
  }
  return { type: "unknown", url: trimmed, label: "Desconocido", icon: "❓" };
}
