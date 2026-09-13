/** Funções puras — porta 1:1 de app/services/metadata.py (v2). */

export function humanNameFromTable(tname: string): string {
  let name = tname;
  for (const prefix of ["etl_", "mod_", "tbl_"]) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  return name
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function mapPgTypeToAppType(
  pgType: string,
  charMaxLength: number | null,
): [string, number | null] {
  const t = pgType.toLowerCase();
  const has = (...xs: string[]) => xs.some((x) => t.includes(x));
  if (has("character varying", "varchar", "text")) return ["varchar", charMaxLength];
  if (has("integer", "int", "smallint", "bigint")) return ["integer", null];
  if (has("numeric", "decimal", "double precision", "real")) return ["numeric", null];
  if (has("geometry", "geography")) return ["geom", null];
  if (t.includes("timestamp")) return ["timestamp", null];
  if (t.includes("date")) return ["date", null];
  return ["varchar", charMaxLength];
}
