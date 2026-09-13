/**
 * Transferência entre bancos (cross-DB).
 *
 * Diferente de metadata/copy (mesmo banco, um Plan único), aqui há duas
 * conexões. Introspecção lê de AMBAS as pontas; o Plan gerado é aplicado
 * apenas no destino (target). DDL/dados/metadados são planos separados.
 */
import type { Queryable } from "../db/types.js";
import { getTableColumns } from "../db/introspect.js";
import { toStr } from "../util/str.js";
import { emptyPlan, ident, placeholders, ref, type Plan, type PlanParam } from "../sqlPlan.js";

const PERM_ID_COLS = new Set(["perm_id", "legacy_perm_id", "id"]);
const PARAM_ID_COLS = new Set(["id", "param_id"]);

export interface TransferOverrides {
  tableName?: string;
  urlBanco?: string;
  workspace?: string;
  geoserverBase?: string;
}

function rowDict(cols: string[], row: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const c of cols) m.set(c, row[c]);
  return m;
}

// ─── DDL ──────────────────────────────────────────────────────────────────────

export async function buildDdlPlan(
  source: Queryable,
  tableName: string,
): Promise<Plan> {
  const plan = emptyPlan();
  const colsResult = await source.query(
    `SELECT
                a.attname,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS fmt,
                a.attnotnull,
                pg_get_expr(d.adbin, d.adrelid) AS def
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE c.relname = $1 AND n.nspname = 'public'
              AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attnum`,
    [tableName],
  );
  if (colsResult.rows.length === 0) {
    throw new Error(`Tabela '${tableName}' não encontrada na origem.`);
  }

  const pkResult = await source.query(
    `SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_name = kcu.table_name
            WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
    [tableName],
  );
  const pks = new Set(pkResult.rows.map((r) => String(r.column_name)));

  const colDefs: string[] = [];
  for (const row of colsResult.rows) {
    const colName = String(row.attname);
    const dataType = String(row.fmt);
    const notNull = Boolean(row.attnotnull);
    const def = row.def === null || row.def === undefined ? null : toStr(row.def);
    const parts = [ident(colName), dataType];
    if (pks.has(colName)) {
      parts.push("PRIMARY KEY");
    } else if (notNull) {
      parts.push("NOT NULL");
    }
    if (def && !def.includes("nextval")) {
      parts.push(`DEFAULT ${def}`);
    }
    colDefs.push(parts.join(" "));
  }

  plan.statements.push({
    purpose: `DDL: CREATE TABLE IF NOT EXISTS ${tableName}`,
    sql: `CREATE TABLE IF NOT EXISTS ${ident(tableName)} (${colDefs.join(", ")})`,
    params: [],
  });
  plan.logs.push(`DDL planejado para '${tableName}' (${String(colDefs.length)} coluna(s)).`);
  return plan;
}

// ─── Dados ────────────────────────────────────────────────────────────────────

export async function buildDataPlan(source: Queryable, tableName: string): Promise<Plan> {
  const plan = emptyPlan();
  const result = await source.query(`SELECT * FROM ${ident(tableName)}`);
  if (result.rows.length === 0) {
    plan.logs.push(`'${tableName}' vazia, nada a copiar.`);
    return plan;
  }
  const colNames = result.fields.map((f) => f.name);
  for (const row of result.rows) {
    plan.statements.push({
      purpose: `Dados: INSERT em ${tableName}`,
      sql: `INSERT INTO ${ident(tableName)} (${colNames.map(ident).join(", ")}) VALUES (${placeholders(
        colNames.length,
      )}) ON CONFLICT DO NOTHING`,
      params: colNames.map((c) => row[c]),
    });
  }
  plan.logs.push(`${String(result.rows.length)} linha(s) planejada(s) para '${tableName}'.`);
  return plan;
}

// ─── Metadados (cross-DB) ─────────────────────────────────────────────────────

export async function buildTransferMetadataPlan(
  source: Queryable,
  target: Queryable,
  sourcePrfId: number,
  themeName: string,
  destPrfId: number,
  destParentMapId: number | null,
  overrides: TransferOverrides = {},
): Promise<Plan> {
  const plan = emptyPlan();
  const log = (m: string) => plan.logs.push(m);
  log(`[X-DB] Iniciando: ${themeName}`);

  // 1. Localizar tema de origem
  let srcResult = await source.query(
    "SELECT * FROM theme WHERE profile_id = $1 AND theme_name = $2",
    [sourcePrfId, themeName],
  );
  if (srcResult.rows.length === 0) {
    srcResult = await source.query(
      `SELECT t.* FROM theme t
            JOIN data_table dt ON dt.table_id = t.table_id
            WHERE t.profile_id = $1 AND dt.name = $2`,
      [sourcePrfId, themeName],
    );
  }
  const srcRow = srcResult.rows[0];
  if (!srcRow) {
    throw new Error(`Tema '${themeName}' não encontrado na origem.`);
  }

  const themeColsSrc = await getTableColumns(source, "theme");
  const themeColsTgt = await getTableColumns(target, "theme");
  const srcTheme = rowDict(themeColsSrc, srcRow);
  const oldThemeId = srcTheme.get("theme_id");
  const oldTableId = srcTheme.get("table_id") ?? null;
  const oldLayerId = srcTheme.get("layer_id") ?? null;

  const destTableName =
    overrides.tableName || (srcTheme.get("table_name") as string | undefined) || themeName;

  // 2. Garantir data_table no destino
  const tableLookup = await target.query("SELECT table_id FROM data_table WHERE name = $1", [
    destTableName,
  ]);
  let newTableIdParam: PlanParam;
  const firstTable = tableLookup.rows[0];
  if (firstTable) {
    newTableIdParam = firstTable.table_id;
    log(`[X-DB] data_table existente: table_id=${String(firstTable.table_id)}`);
  } else {
    // connection_url de qualquer linha existente (mesmo comportamento do original)
    let urlDest: unknown;
    try {
      const urlResult = await target.query(
        "SELECT connection_url FROM data_table WHERE connection_url IS NOT NULL LIMIT 1",
      );
      urlDest = urlResult.rows[0]?.connection_url ?? null;
    } catch {
      urlDest = null;
    }
    if (urlDest === null) urlDest = overrides.urlBanco ?? null;

    const tableRef = "table_id__transfer";
    plan.statements.push({
      purpose: `[X-DB] Criar data_table '${destTableName}' no destino`,
      sql: "INSERT INTO data_table (name, connection_url) VALUES ($1, $2) RETURNING table_id",
      params: [destTableName, urlDest],
      returning: { column: "table_id", ref: tableRef },
    });
    newTableIdParam = ref(tableRef);
  }

  // 3. Inserir theme no destino
  const themeRef = "theme_id__transfer";
  const newTheme = new Map<string, PlanParam>();
  for (const col of themeColsTgt) {
    if (col === "theme_id") continue;
    if (col === "profile_id") newTheme.set(col, destPrfId);
    else if (col === "table_id") newTheme.set(col, newTableIdParam);
    else if (col === "table_name") newTheme.set(col, destTableName);
    else newTheme.set(col, srcTheme.get(col));
  }
  const themeInsCols = [...newTheme.keys()];
  plan.statements.push({
    purpose: `[X-DB] Copiar theme '${themeName}' (origem theme_id=${String(oldThemeId)})`,
    sql: `INSERT INTO theme (${themeInsCols.map(ident).join(", ")}) VALUES (${placeholders(
      themeInsCols.length,
    )}) RETURNING theme_id`,
    params: themeInsCols.map((c) => newTheme.get(c)),
    returning: { column: "theme_id", ref: themeRef },
  });
  log(`[X-DB] theme: ${String(oldThemeId)} -> :${themeRef}`);

  // 4. Copiar layer
  let layerRef: string | null = null;
  try {
    const srcLayerCols = await getTableColumns(source, "layer");
    const tgtLayerCols = await getTableColumns(target, "layer");

    let layerRows: Record<string, unknown>[] = [];
    if (srcLayerCols.includes("theme_id")) {
      layerRows = (await source.query("SELECT * FROM layer WHERE theme_id = $1", [oldThemeId]))
        .rows;
    } else if (srcLayerCols.includes("table_id") && oldTableId !== null) {
      layerRows = (await source.query("SELECT * FROM layer WHERE table_id = $1", [oldTableId]))
        .rows;
    }

    const returning = tgtLayerCols.includes("layer_id");
    let idx = 0;
    for (const row of layerRows) {
      const s = rowDict(srcLayerCols, row);
      const d = new Map<string, PlanParam>();
      for (const col of tgtLayerCols) {
        if (col === "layer_id") continue;
        if (col === "theme_id") d.set(col, ref(themeRef));
        else if (col === "table_id") d.set(col, newTableIdParam);
        else d.set(col, s.get(col));
      }
      const insCols = [...d.keys()];
      const thisRef = `layer_id__transfer__${String(idx++)}`;
      plan.statements.push({
        purpose: `[X-DB] Copiar layer do tema '${themeName}'`,
        sql: `INSERT INTO layer (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
          insCols.length,
        )})${returning ? " RETURNING layer_id" : ""}`,
        params: insCols.map((c) => d.get(c)),
        ...(returning ? { returning: { column: "layer_id", ref: thisRef } } : {}),
      });
      if (returning) layerRef = thisRef;
    }

    if (layerRef && oldLayerId !== null && themeColsTgt.includes("layer_id")) {
      plan.statements.push({
        purpose: `[X-DB] Atualizar theme.layer_id`,
        sql: "UPDATE theme SET layer_id = $1 WHERE theme_id = $2",
        params: [ref(layerRef), ref(themeRef)],
      });
    }
    log(`[X-DB] layer: ${String(layerRows.length)} linha(s)`);
  } catch (err) {
    log(`[X-DB] AVISO: layer ignorado (${err instanceof Error ? err.message : String(err)})`);
  }

  // 5. Copiar data_dictionary (mapa old dict_id -> ref)
  const dictRefByOld = new Map<unknown, string>();
  if (oldTableId !== null) {
    const dictResult = await source.query("SELECT * FROM data_dictionary WHERE table_id = $1", [
      oldTableId,
    ]);
    if (dictResult.rows.length > 0) {
      const dictColsSrc = await getTableColumns(source, "data_dictionary");
      const dictColsTgt = await getTableColumns(target, "data_dictionary");
      const hasDictId = dictColsTgt.includes("dict_id");
      let idx = 0;
      for (const row of dictResult.rows) {
        const s = rowDict(dictColsSrc, row);
        const oldDictId = s.get("dict_id");
        const d = new Map<string, PlanParam>();
        for (const col of dictColsTgt) {
          if (col === "dict_id") continue;
          if (col === "table_id") d.set(col, newTableIdParam);
          else if (col === "table_name") d.set(col, destTableName);
          else d.set(col, s.get(col));
        }
        const insCols = [...d.keys()];
        const thisRef = `dict_id__transfer__${String(idx++)}`;
        plan.statements.push({
          purpose: `[X-DB] Copiar data_dictionary (${String(s.get("attribute_name"))})`,
          sql: `INSERT INTO data_dictionary (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
            insCols.length,
          )})${hasDictId ? " RETURNING dict_id" : ""}`,
          params: insCols.map((c) => d.get(c)),
          ...(hasDictId ? { returning: { column: "dict_id", ref: thisRef } } : {}),
        });
        if (hasDictId && oldDictId !== null && oldDictId !== undefined) {
          dictRefByOld.set(oldDictId, thisRef);
        }
      }
      log(`[X-DB] data_dictionary: ${String(dictResult.rows.length)} linha(s)`);
    }
  }

  // 6. Copiar permission
  const permResult = await source.query("SELECT * FROM permission WHERE theme_id = $1", [
    oldThemeId,
  ]);
  if (permResult.rows.length > 0) {
    const permColsSrc = await getTableColumns(source, "permission");
    const permColsTgt = await getTableColumns(target, "permission");
    for (const row of permResult.rows) {
      const s = rowDict(permColsSrc, row);
      const d = new Map<string, PlanParam>();
      for (const col of permColsTgt) {
        if (PERM_ID_COLS.has(col)) continue;
        if (col === "theme_id") d.set(col, ref(themeRef));
        else if (col === "dict_id" && dictRefByOld.size > 0) {
          const oldDict = s.get("dict_id");
          const r = dictRefByOld.get(oldDict);
          d.set(col, r ? ref(r) : null);
        } else d.set(col, s.get(col));
      }
      const insCols = [...d.keys()];
      plan.statements.push({
        purpose: `[X-DB] Copiar permission do tema '${themeName}'`,
        sql: `INSERT INTO permission (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
          insCols.length,
        )})`,
        params: insCols.map((c) => d.get(c)),
      });
    }
    log(`[X-DB] permission: ${String(permResult.rows.length)} linha(s)`);
  }

  // 7. Copiar map_node + map_param
  const mapResult = await source.query("SELECT * FROM map_node WHERE theme_id = $1", [oldThemeId]);
  if (mapResult.rows.length === 0) {
    log("[X-DB] Tema tabular (sem map_node).");
    return plan;
  }

  const mapColsSrc = await getTableColumns(source, "map_node");
  const mapColsTgt = await getTableColumns(target, "map_node");
  const paramColsSrc = await getTableColumns(source, "map_param");
  const paramColsTgt = await getTableColumns(target, "map_param");

  const wsOverride = overrides.workspace || "";
  const gsOverride = overrides.geoserverBase || "";

  let mapIdx = 0;
  for (const mapRow of mapResult.rows) {
    const sMap = rowDict(mapColsSrc, mapRow);
    const oldMapId = sMap.get("map_id");
    const dMap = new Map<string, PlanParam>();
    for (const col of mapColsTgt) {
      if (col === "map_id") continue;
      if (col === "profile_id") dMap.set(col, destPrfId);
      else if (col === "theme_id") dMap.set(col, ref(themeRef));
      else if (col === "parent_map_id") dMap.set(col, destParentMapId);
      else dMap.set(col, sMap.get(col));
    }
    const mapInsCols = [...dMap.keys()];
    const mapRef = `map_id__transfer__${String(mapIdx++)}`;
    plan.statements.push({
      purpose: `[X-DB] Copiar map_node ${String(oldMapId)}`,
      sql: `INSERT INTO map_node (${mapInsCols.map(ident).join(", ")}) VALUES (${placeholders(
        mapInsCols.length,
      )}) RETURNING map_id`,
      params: mapInsCols.map((c) => dMap.get(c)),
      returning: { column: "map_id", ref: mapRef },
    });
    log(`[X-DB] mapa: ${String(oldMapId)} -> :${mapRef}`);

    const paramResult = await source.query("SELECT * FROM map_param WHERE map_id = $1", [oldMapId]);

    // Inferir workspace do param url (se não houver override)
    let wsFromUrl: string | null = null;
    if (!wsOverride) {
      for (const prow of paramResult.rows) {
        const p = rowDict(paramColsSrc, prow);
        if (p.get("param") === "url" && typeof p.get("value") === "string") {
          const parts = String(p.get("value")).replace(/^\/+|\/+$/g, "").split("/");
          if (parts.length >= 2) wsFromUrl = parts[parts.length - 2] ?? null;
          break;
        }
      }
    }

    for (const prow of paramResult.rows) {
      const sParam = rowDict(paramColsSrc, prow);
      const dParam = new Map<string, PlanParam>();
      for (const col of paramColsTgt) {
        if (PARAM_ID_COLS.has(col)) continue;
        if (col === "map_id") dParam.set(col, ref(mapRef));
        else if (col === "theme_id") dParam.set(col, ref(themeRef));
        else if (col === "layer_id" && layerRef) dParam.set(col, ref(layerRef));
        else if (col === "profile_id") dParam.set(col, destPrfId);
        else if (col === "value") {
          const pname = sParam.get("param");
          if (pname === "url" && gsOverride) {
            dParam.set(col, gsOverride);
          } else if (pname === "layers") {
            let ws = wsOverride || wsFromUrl;
            if (!ws) {
              const v = sParam.get("value");
              ws = typeof v === "string" && v.includes(":") ? (v.split(":")[0] ?? null) : null;
            }
            dParam.set(col, ws ? `${ws}:${destTableName}` : destTableName);
          } else {
            dParam.set(col, sParam.get(col));
          }
        } else {
          dParam.set(col, sParam.get(col));
        }
      }
      const insCols = [...dParam.keys()];
      plan.statements.push({
        purpose: `[X-DB] Copiar map_param (${String(sParam.get("param"))})`,
        sql: `INSERT INTO map_param (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
          insCols.length,
        )})`,
        params: insCols.map((c) => dParam.get(c)),
      });
    }
  }

  log("[X-DB] Concluído.");
  return plan;
}
