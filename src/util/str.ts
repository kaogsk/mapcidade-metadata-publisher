/**
 * Coerção segura de valor desconhecido (célula de banco) para string.
 * Objetos viram JSON; null/undefined viram ""; escalares usam String().
 */
export function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  return JSON.stringify(v);
}
