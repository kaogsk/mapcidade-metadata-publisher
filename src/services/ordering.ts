/** Reordenação da árvore map_node por perfil. */
import type { Plan } from "../sqlPlan.js";

export function appendReorderStatements(plan: Plan, prfId: number): void {
  plan.statements.push({
    purpose: "Reordenar mapas: limpar tabela temporária",
    sql: "DROP TABLE IF EXISTS reorder_scratch",
    params: [],
  });
  plan.statements.push({
    purpose: `Reordenar mapas: montar árvore de ordenação (profile_id=${String(prfId)})`,
    sql: `
        CREATE TEMP TABLE reorder_scratch AS (
            WITH RECURSIVE tree (map_id, new_order) AS (
                SELECT
                    map_id,
                    lpad(cast(row_number() OVER (PARTITION BY profile_id, parent_map_id ORDER BY name) - 1 AS varchar), 2, '0')
                FROM map_node
                WHERE parent_map_id IS NULL AND profile_id = $1

                UNION ALL

                SELECT
                    mn.map_id,
                    tr.new_order || '.' || lpad(cast(
                        row_number() OVER (PARTITION BY mn.profile_id, mn.parent_map_id ORDER BY mn.name) - 1
                    AS varchar), 2, '0')
                FROM map_node mn
                INNER JOIN tree tr ON mn.parent_map_id = tr.map_id
                WHERE mn.profile_id = $2
            )
            SELECT map_id, new_order FROM tree
        )
        `,
    params: [prfId, prfId],
  });
  plan.statements.push({
    purpose: `Reordenar mapas: aplicar nova ordem (profile_id=${String(prfId)})`,
    sql: `
        UPDATE map_node
        SET order_index = reorder_scratch.new_order
        FROM reorder_scratch
        WHERE map_node.map_id = reorder_scratch.map_id AND map_node.profile_id = $1
        `,
    params: [prfId],
  });
}
