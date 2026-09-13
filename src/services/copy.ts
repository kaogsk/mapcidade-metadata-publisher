/** Copiar temas dentro do mesmo banco. */
import type { Queryable } from "../db/types.js";
import { getTableColumns, recordExists } from "../db/introspect.js";
import { emptyPlan, ident, placeholders, ref, type Plan } from "../sqlPlan.js";
import { appendReorderStatements } from "./ordering.js";

// Ambientes diferentes historicamente batizaram a PK da tabela de permissão
// de formas diferentes; o planner tolera as três variantes.
const PERM_ID_COLS = new Set(["perm_id", "legacy_perm_id", "id"]);
const PARAM_ID_COLS = new Set(["id", "param_id"]);

export interface CopyThemePlanResult {
  themeName: string;
  skipped?: string;
  plan: Plan;
}

function rowDict(cols: string[], row: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const c of cols) m.set(c, row[c]);
  return m;
}

export async function buildCopyThemePlan(
  q: Queryable,
  sourcePrfId: number,
  themeName: string,
  destPrfId: number,
  destParentMapId: number | null,
): Promise<CopyThemePlanResult> {
  const plan = emptyPlan();
  const log = (m: string) => plan.logs.push(m);

  // 1. Já existe no destino?
  if (
    await recordExists(
      q,
      `SELECT 1 FROM ${ident("theme")} WHERE profile_id = $1 AND theme_name = $2 LIMIT 1`,
      [destPrfId, themeName],
    )
  ) {
    const msg = `AVISO: '${themeName}' já existe no destino. Pulando.`;
    log(msg);
    return { themeName, skipped: msg, plan };
  }

  // 2. Localizar tema de origem (3 fallbacks, mesma ordem do original)
  let srcResult = await q.query(
    "SELECT * FROM theme WHERE profile_id = $1 AND theme_name = $2",
    [sourcePrfId, themeName],
  );
  if (srcResult.rows.length === 0) {
    srcResult = await q.query(
      `SELECT t.* FROM theme t
            JOIN data_table dt ON dt.table_id = t.table_id
            WHERE t.profile_id = $1 AND dt.name = $2`,
      [sourcePrfId, themeName],
    );
  }
  if (srcResult.rows.length === 0) {
    srcResult = await q.query("SELECT * FROM theme WHERE profile_id = $1 AND table_name = $2", [
      sourcePrfId,
      themeName,
    ]);
  }
  const srcRow = srcResult.rows[0];
  if (!srcRow) {
    throw new Error(`Tema '${themeName}' não encontrado na origem (profile_id=${String(sourcePrfId)}).`);
  }

  const themeCols = await getTableColumns(q, "theme");
  const src = rowDict(themeCols, srcRow);
  const oldThemeId = src.get("theme_id");

  // 3. Inserir novo tema (todas as colunas exceto theme_id; profile_id sobrescrito)
  src.set("profile_id", destPrfId);
  const themeInsertCols = themeCols.filter((c) => c !== "theme_id");
  const themeRef = `theme_id__${themeName}`;
  plan.statements.push({
    purpose: `Copiar theme '${themeName}' (origem theme_id=${String(oldThemeId)})`,
    sql: `INSERT INTO theme (${themeInsertCols.map(ident).join(", ")}) VALUES (${placeholders(
      themeInsertCols.length,
    )}) RETURNING theme_id`,
    params: themeInsertCols.map((c) => src.get(c)),
    returning: { column: "theme_id", ref: themeRef },
  });
  log(`  tema: ${String(oldThemeId)} -> :${themeRef}`);

  // 4. Copiar permissões
  const permResult = await q.query("SELECT * FROM permission WHERE theme_id = $1", [oldThemeId]);
  if (permResult.rows.length > 0) {
    const permCols = await getTableColumns(q, "permission");
    for (const row of permResult.rows) {
      const perm = rowDict(permCols, row);
      perm.set("theme_id", ref(themeRef));
      const insCols = permCols.filter((c) => !PERM_ID_COLS.has(c));
      plan.statements.push({
        purpose: `Copiar permission do tema '${themeName}'`,
        sql: `INSERT INTO permission (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
          insCols.length,
        )})`,
        params: insCols.map((c) => perm.get(c)),
      });
    }
    log(`  permissões copiadas: ${String(permResult.rows.length)}`);
  }

  // 5. Copiar mapas + parâmetros
  const mapResult = await q.query("SELECT * FROM map_node WHERE theme_id = $1", [oldThemeId]);
  if (mapResult.rows.length === 0) {
    log("  tema tabular (sem map_node).");
    return { themeName, plan };
  }

  const mapCols = await getTableColumns(q, "map_node");
  const paramCols = await getTableColumns(q, "map_param");

  for (const mapRow of mapResult.rows) {
    const map = rowDict(mapCols, mapRow);
    const oldMapId = map.get("map_id");
    map.set("profile_id", destPrfId);
    map.set("theme_id", ref(themeRef));
    map.set("parent_map_id", destParentMapId);
    const mapInsCols = mapCols.filter((c) => c !== "map_id");
    const mapRef = `map_id__${themeName}__${String(oldMapId)}`;
    plan.statements.push({
      purpose: `Copiar map_node ${String(oldMapId)} do tema '${themeName}'`,
      sql: `INSERT INTO map_node (${mapInsCols.map(ident).join(", ")}) VALUES (${placeholders(
        mapInsCols.length,
      )}) RETURNING map_id`,
      params: mapInsCols.map((c) => map.get(c)),
      returning: { column: "map_id", ref: mapRef },
    });
    log(`  mapa: ${String(oldMapId)} -> :${mapRef}`);

    const paramResult = await q.query("SELECT * FROM map_param WHERE map_id = $1", [oldMapId]);
    for (const row of paramResult.rows) {
      const param = rowDict(paramCols, row);
      param.set("map_id", ref(mapRef));
      if (param.has("theme_id")) param.set("theme_id", ref(themeRef));
      if (param.has("profile_id")) param.set("profile_id", destPrfId);
      const insCols = paramCols.filter((c) => !PARAM_ID_COLS.has(c));
      plan.statements.push({
        purpose: `Copiar map_param do mapa ${String(oldMapId)}`,
        sql: `INSERT INTO map_param (${insCols.map(ident).join(", ")}) VALUES (${placeholders(
          insCols.length,
        )})`,
        params: insCols.map((c) => param.get(c)),
      });
    }
  }

  return { themeName, plan };
}

export interface CopyThemesPlans {
  themes: CopyThemePlanResult[];
  /** Reordenação final do perfil de destino. */
  reorder: Plan;
}

export async function buildCopyThemesPlans(
  q: Queryable,
  sourcePrfId: number,
  destPrfId: number,
  themes: string[],
  parentMapId: number | null,
): Promise<CopyThemesPlans> {
  const results: CopyThemePlanResult[] = [];
  for (const themeName of themes) {
    try {
      results.push(await buildCopyThemePlan(q, sourcePrfId, themeName, destPrfId, parentMapId));
    } catch (err) {
      const msg = `ERRO em '${themeName}': ${err instanceof Error ? err.message : String(err)}`;
      results.push({ themeName, skipped: msg, plan: emptyPlan() });
    }
  }
  const reorder = emptyPlan();
  appendReorderStatements(reorder, destPrfId);
  return { themes: results, reorder };
}
