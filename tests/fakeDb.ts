import type { Queryable, QueryResultLike } from "../src/db/types.js";

type Handler = (params: unknown[]) => QueryResultLike;

interface Rule {
  match: (sql: string, params: unknown[]) => boolean;
  handler: Handler;
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Queryable de teste. Registra respostas por padrão de SQL. Registra também
 * todos os SQLs executados (para garantir que planners NÃO escrevem no banco:
 * eles só devem emitir SELECTs).
 */
export class FakeDb implements Queryable {
  private rules: Rule[] = [];
  readonly executed: { sql: string; params: unknown[] }[] = [];

  on(substr: string, handler: Handler): this {
    const needle = normalize(substr);
    this.rules.push({ match: (sql) => normalize(sql).includes(needle), handler });
    return this;
  }

  onMatch(match: (sql: string, params: unknown[]) => boolean, handler: Handler): this {
    this.rules.push({ match, handler });
    return this;
  }

  query(sql: string, params: unknown[] = []): Promise<QueryResultLike> {
    this.executed.push({ sql, params });
    for (const rule of this.rules) {
      if (rule.match(sql, params)) {
        return Promise.resolve(rule.handler(params));
      }
    }
    return Promise.resolve({ rows: [], fields: [], rowCount: 0 });
  }

  /** SQLs que não são SELECT/BEGIN/COMMIT — usado para provar dry-run. */
  writeStatements(): string[] {
    return this.executed
      .map((e) => e.sql.trim())
      .filter((s) => !/^(select|begin|commit|rollback|drop table if exists ordenacao)/i.test(s));
  }
}

export function result(
  rows: Record<string, unknown>[],
  fields?: string[],
): QueryResultLike {
  const f =
    fields ?? (rows[0] ? Object.keys(rows[0]).map((name) => ({ name })) : []);
  return {
    rows,
    fields: Array.isArray(f) && typeof f[0] === "string" ? (f as string[]).map((name) => ({ name })) : (f as { name: string }[]),
    rowCount: rows.length,
  };
}

export function columnsResult(cols: string[]): QueryResultLike {
  return { rows: [], fields: cols.map((name) => ({ name })), rowCount: 0 };
}
