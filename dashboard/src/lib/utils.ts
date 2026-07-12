export function formatXp(xp: bigint | string | number): string {
  const num = typeof xp === "bigint" ? Number(xp) : Number(xp);
  return num.toLocaleString();
}


export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
