/** Consultas read-only para popular os selects da UI. */
import type { Queryable } from "../db/types.js";

export interface Profile {
  id: number;
  name: string;
}
export interface Theme {
  id: number;
  name: string;
}
export interface MapFolder {
  id: number;
  name: string;
}
export interface TableRef {
  schema: string;
  name: string;
}

export async function listProfiles(q: Queryable): Promise<Profile[]> {
  const r = await q.query("SELECT profile_id, profile_name FROM profile ORDER BY profile_name");
  return r.rows.map((row) => ({ id: Number(row.profile_id), name: String(row.profile_name) }));
}

export async function listThemes(q: Queryable, prfId: number): Promise<Theme[]> {
  const r = await q.query(
    "SELECT theme_id, theme_name FROM theme WHERE profile_id = $1 ORDER BY theme_name",
    [prfId],
  );
  return r.rows.map((row) => ({ id: Number(row.theme_id), name: String(row.theme_name) }));
}

export async function listMapFolders(q: Queryable, prfId: number): Promise<MapFolder[]> {
  const r = await q.query(
    "SELECT map_id, name FROM map_node WHERE profile_id = $1 AND kind IN ('folder','group') ORDER BY name",
    [prfId],
  );
  return r.rows.map((row) => ({ id: Number(row.map_id), name: String(row.name) }));
}

export async function listTables(q: Queryable): Promise<TableRef[]> {
  const r = await q.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
     ORDER BY table_schema, table_name`,
  );
  return r.rows.map((row) => ({
    schema: String(row.table_schema),
    name: String(row.table_name),
  }));
}
