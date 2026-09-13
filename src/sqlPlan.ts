/**
 * SqlPlan — toda escrita do app passa por aqui.
 *
 * Um "plano" é a lista ordenada de statements de escrita (INSERT/UPDATE/DDL)
 * que SERIAM executados. O modo padrão de todos os endpoints de escrita é
 * dry-run: o plano é devolvido como preview e NADA é executado. A execução
 * real exige `execute: true` + `confirm: "EXECUTAR"` e roda o plano dentro
 * de transação, resolvendo referências a IDs gerados (RETURNING).
 */
import type { Queryable } from "./db/types.js";

/** Referência simbólica a um valor gerado por um statement anterior (RETURNING). */
export interface Ref {
  $ref: string;
}

/** Parâmetro de um statement: um valor literal qualquer ou uma {@link Ref} (detectada por isRef). */
export type PlanParam = unknown;

export function ref(name: string): Ref {
  return { $ref: name };
}

export function isRef(v: unknown): v is Ref {
  return typeof v === "object" && v !== null && "$ref" in v;
}

export interface PlannedStatement {
  /** Descrição humana do que o statement faz. */
  purpose: string;
  /** SQL com placeholders $1..$n. */
  sql: string;
  params: PlanParam[];
  /** Captura rows[0][column] no registrador `ref` após executar. */
  returning?: { column: string; ref: string };
}

export interface Plan {
  statements: PlannedStatement[];
  logs: string[];
}

export function emptyPlan(): Plan {
  return { statements: [], logs: [] };
}

export interface StatementPreview {
  purpose: string;
  sql: string;
  params: unknown[];
}

/** Preview serializável do plano (refs viram strings ":nome"). */
export function renderPreview(plan: Plan): StatementPreview[] {
  return plan.statements.map((st) => ({
    purpose: st.purpose,
    sql: st.sql,
    params: st.params.map((p) => (isRef(p) ? `:${p.$ref}` : p)),
  }));
}

export interface ExecutedStatement {
  purpose: string;
  sql: string;
  params: unknown[];
}

/**
 * Executa o plano em ordem num Queryable (que deve estar dentro de transação,
 * responsabilidade do chamador). Resolve refs a partir dos RETURNING anteriores.
 */
export async function executePlan(
  q: Queryable,
  plan: Plan,
  log?: (msg: string) => void,
): Promise<ExecutedStatement[]> {
  const registry = new Map<string, unknown>();
  const executed: ExecutedStatement[] = [];

  for (const st of plan.statements) {
    const params = st.params.map((p) => {
      if (isRef(p)) {
        if (!registry.has(p.$ref)) {
          throw new Error(`Referência não resolvida no plano: ${p.$ref}`);
        }
        return registry.get(p.$ref);
      }
      return p;
    });

    const result = await q.query(st.sql, params);
    executed.push({ purpose: st.purpose, sql: st.sql, params });

    if (st.returning) {
      const row = result.rows[0];
      if (!row || !(st.returning.column in row)) {
        throw new Error(
          `Statement "${st.purpose}" não devolveu a coluna ${st.returning.column} no RETURNING`,
        );
      }
      registry.set(st.returning.ref, row[st.returning.column]);
      log?.(`${st.purpose}: ${st.returning.ref} = ${String(row[st.returning.column])}`);
    } else {
      log?.(st.purpose);
    }
  }

  return executed;
}

/** Placeholders $1..$n para um INSERT com n colunas. */
export function placeholders(n: number, offset = 0): string {
  return Array.from({ length: n }, (_, i) => `$${i + 1 + offset}`).join(", ");
}

/** Identificador SQL entre aspas duplas (mesmo formato do psycopg2 sql.Identifier). */
export function ident(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
