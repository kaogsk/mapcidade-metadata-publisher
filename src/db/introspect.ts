/** Introspecção read-only usada pelos planners (mesmas queries do Python). */
import type { Queryable } from "./types.js";
import { ident } from "../sqlPlan.js";

/** Colunas na ordem física da tabela (equivale a SELECT * LIMIT 0 + cursor.description). */
export async function getTableColumns(q: Queryable, tableName: string): Promise<string[]> {
  const result = await q.query(`SELECT * FROM ${ident(tableName)} LIMIT 0`);
  return result.fields.map((f) => f.name);
}

export async function tableOrViewExists(q: Queryable, name: string): Promise<boolean> {
  const result = await q.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1
     UNION ALL
     SELECT 1 FROM information_schema.views WHERE table_name = $2
     LIMIT 1`,
    [name, name],
  );
  return result.rows.length > 0;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  charMaxLength: number | null;
}

export async function getColumnsInfo(q: Queryable, tableName: string): Promise<ColumnInfo[]> {
  const result = await q.query(
    `SELECT column_name, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [tableName],
  );
  return result.rows.map((r) => ({
    columnName: String(r.column_name),
    dataType: String(r.data_type),
    charMaxLength: r.character_maximum_length === null ? null : Number(r.character_maximum_length),
  }));
}

export async function getColumnNamesSet(q: Queryable, tableName: string): Promise<Set<string>> {
  const result = await q.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName],
  );
  return new Set(result.rows.map((r) => String(r.column_name)));
}

export async function recordExists(
  q: Queryable,
  sql: string,
  params: unknown[],
): Promise<boolean> {
  const result = await q.query(sql, params);
  return result.rows.length > 0;
}
