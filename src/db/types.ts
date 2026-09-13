/** Abstração mínima de acesso a banco — permite mockar nos testes e no parity harness. */
export interface QueryResultLike {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  rowCount: number | null;
}

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<QueryResultLike>;
}
