/**
 * Criar temas — planner que só roda SELECTs (introspecção + lookups) e
 * devolve o Plan com todos os INSERTs/UPDATEs que seriam executados, na
 * mesma ordem e com os mesmos parâmetros. A execução real fica a cargo da rota.
 */
import type { Queryable } from "../db/types.js";
import {
  getColumnNamesSet,
  getColumnsInfo,
  tableOrViewExists,
} from "../db/introspect.js";
import { emptyPlan, ident, ref, type Plan, type PlanParam } from "../sqlPlan.js";
import { humanNameFromTable, mapPgTypeToAppType } from "./naming.js";
import { appendReorderStatements } from "./ordering.js";

export interface CreateThemesInput {
  tablesRaw: string;
  prfId: number;
  /** Vazio => tema tabular. */
  mapParentName: string;
  workspace: string;
  geoserverBase: string;
  urlBanco: string;
}

/** Candidatas de coluna do dicionário, sempre na mesma ordem. */
const DICTIONARY_CANDIDATES = (
  colName: string,
  appType: string,
  maxLen: number | null,
  table: string,
): [string, unknown][] => [
  ["attribute_name", colName],
  ["label", colName],
  ["data_type", appType],
  ["char_length", maxLen],
  ["pk", false],
  ["table_name", table],
  ["description", null],
  ["domain", null],
  ["store_with_mask", false],
  ["oid", false],
];

export async function buildCreateThemesPlan(
  q: Queryable,
  input: CreateThemesInput,
): Promise<Plan> {
  const plan = emptyPlan();
  const log = (m: string) => plan.logs.push(m);

  const temaTabular = input.mapParentName.trim() === "";
  const tables = input.tablesRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tables.length === 0) {
    throw new Error("Nenhuma tabela informada.");
  }

  // Detectar coluna de ligação de data_dictionary (theme_id ou table_id)
  const dictCols = await getColumnNamesSet(q, "data_dictionary");
  let dictFkCol: string;
  let dictFkUsesTheme: boolean;
  if (dictCols.has("theme_id")) {
    dictFkCol = "theme_id";
    dictFkUsesTheme = true;
  } else if (dictCols.has("table_id")) {
    dictFkCol = "table_id";
    dictFkUsesTheme = false;
  } else {
    throw new Error("data_dictionary sem coluna theme_id ou table_id.");
  }

  for (const table of tables) {
    log(`Processando: ${table}`);

    if (!(await tableOrViewExists(q, table))) {
      throw new Error(`Tabela/View '${table}' não encontrada no banco.`);
    }

    // Garantir entrada em data_table
    const tableLookup = await q.query("SELECT table_id FROM data_table WHERE name = $1", [table]);
    let tableIdParam: PlanParam;
    const firstTable = tableLookup.rows[0];
    if (firstTable) {
      tableIdParam = firstTable.table_id;
      log(`  data_table existente (table_id=${String(firstTable.table_id)})`);
    } else {
      const tableRef = `table_id__${table}`;
      plan.statements.push({
        purpose: `Criar data_table para '${table}'`,
        sql: "INSERT INTO data_table (name, connection_url) VALUES ($1, $2) RETURNING table_id",
        params: [table, input.urlBanco],
        returning: { column: "table_id", ref: tableRef },
      });
      tableIdParam = ref(tableRef);
    }

    // Inserir theme
    const themeName = humanNameFromTable(table);
    const themeRef = `theme_id__${table}`;
    plan.statements.push({
      purpose: `Criar theme '${themeName}'`,
      sql: "INSERT INTO theme (theme_name, table_id, profile_id) VALUES ($1, $2, $3) RETURNING theme_id",
      params: [themeName, tableIdParam, input.prfId],
      returning: { column: "theme_id", ref: themeRef },
    });
    log(`  tema: ${themeName}`);

    const fkValue: PlanParam = dictFkUsesTheme ? ref(themeRef) : tableIdParam;

    // Dicionário de dados: uma linha por coluna da tabela
    const columns = await getColumnsInfo(q, table);
    for (const col of columns) {
      const [appType, maxLen] = mapPgTypeToAppType(col.dataType, col.charMaxLength);
      const rowCols: string[] = [dictFkCol];
      const rowVals: PlanParam[] = [fkValue];
      for (const [c, v] of DICTIONARY_CANDIDATES(col.columnName, appType, maxLen, table)) {
        if (dictCols.has(c)) {
          rowCols.push(c);
          rowVals.push(v);
        }
      }
      plan.statements.push({
        purpose: `Dicionário: ${table}.${col.columnName} (${appType})`,
        sql: `INSERT INTO data_dictionary (${rowCols.map(ident).join(", ")}) VALUES (${rowCols
          .map((_, i) => `$${i + 1}`)
          .join(", ")})`,
        params: rowVals,
      });
    }
    log(`  dicionário: ${String(columns.length)} coluna(s)`);

    if (!temaTabular) {
      const mapRef = `map_id__${table}`;
      plan.statements.push({
        purpose: `Criar map_node '${themeName}' sob '${input.mapParentName}'`,
        sql: `
                        INSERT INTO map_node (name, theme_id, profile_id, kind, order_index, workspace, geoserver_base, parent_map_id)
                        VALUES ($1, $2, $3, 'theme', 0, $4, $5,
                            (SELECT map_id FROM map_node WHERE name = $6 AND profile_id = $7 LIMIT 1))
                        RETURNING map_id
                        `,
        params: [
          themeName,
          ref(themeRef),
          input.prfId,
          input.workspace,
          input.geoserverBase,
          input.mapParentName,
          input.prfId,
        ],
        returning: { column: "map_id", ref: mapRef },
      });

      plan.statements.push({
        purpose: `Parâmetros WMS padrão do map_node de '${themeName}'`,
        sql: `
                        INSERT INTO map_param (map_id, param, value, profile_id) VALUES
                        ($1, 'url', $2, $3),
                        ($4, 'layers', $5, $6),
                        ($7, 'transparent', 'true', $8),
                        ($9, 'format', 'image/png', $10),
                        ($11, 'version', '1.1.1', $12),
                        ($13, 'request', 'GetMap', $14)
                        `,
        params: [
          ref(mapRef),
          input.urlBanco,
          input.prfId,
          ref(mapRef),
          table,
          input.prfId,
          ref(mapRef),
          input.prfId,
          ref(mapRef),
          input.prfId,
          ref(mapRef),
          input.prfId,
          ref(mapRef),
          input.prfId,
        ],
      });
      log("  map node + parâmetros planejados");
    }

    appendReorderStatements(plan, input.prfId);
  }

  return plan;
}
