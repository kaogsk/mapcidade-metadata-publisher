/**
 * Conexão Postgres via `pg` direto (porta do DBConnection do Python),
 * com túnel SSH opcional via ssh2. Nunca usa autocommit implícito para
 * escrita: os planos rodam dentro de BEGIN/COMMIT explícitos nas rotas.
 */
import pg from "pg";
import type { ConnectionInput } from "../schemas.js";
import { openTunnel, type SshTunnel } from "./tunnel.js";
import type { Queryable } from "./types.js";
import { toStr } from "../util/str.js";

export interface OpenConnection extends Queryable {
  client: pg.Client;
  close(): Promise<void>;
}

export async function openConnection(cfg: ConnectionInput): Promise<OpenConnection> {
  let tunnel: SshTunnel | null = null;
  let host = cfg.host;
  let port = cfg.port;

  if (cfg.ssh) {
    tunnel = await openTunnel(cfg.ssh);
    host = tunnel.localHost;
    port = tunnel.localPort;
  }

  const client = new pg.Client({
    host,
    port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectionTimeoutMillis: 20_000,
    options: "-c client_encoding=UTF8",
  });

  try {
    await client.connect();
  } catch (err) {
    if (tunnel) await tunnel.close();
    throw err;
  }

  return {
    client,
    query: (sql: string, params?: unknown[]) => client.query(sql, params),
    close: async () => {
      try {
        await client.end();
      } finally {
        if (tunnel) await tunnel.close();
      }
    },
  };
}

export async function testConnection(cfg: ConnectionInput): Promise<{ ok: boolean; message: string }> {
  let conn: OpenConnection | null = null;
  try {
    conn = await openConnection(cfg);
    const result = await conn.query("SELECT version()");
    const version = toStr(result.rows[0]?.version);
    return { ok: true, message: `Conexão OK: ${version.slice(0, 60)}` };
  } catch (err) {
    return { ok: false, message: friendlyError(err) };
  } finally {
    if (conn) await conn.close();
  }
}

/** Porta do _friendly_error do v2. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  const pgcode = (e as { code?: string }).code ?? "";

  if (pgcode === "28P01" || pgcode === "28000" || lower.includes("password authentication failed")) {
    return "Senha incorreta ou usuário sem permissão.";
  }
  if (pgcode === "3D000" || (lower.includes("database") && lower.includes("does not exist"))) {
    return "Banco de dados não encontrado. Verifique o nome do banco.";
  }
  if (
    lower.includes("could not connect to server") ||
    lower.includes("connection refused") ||
    pgcode === "ECONNREFUSED"
  ) {
    return "Servidor não encontrado. Verifique host e porta.";
  }
  if (lower.includes("timed out") || lower.includes("timeout") || pgcode === "ETIMEDOUT") {
    return "Timeout: servidor não respondeu. Verifique host/porta ou use SSH tunnel.";
  }
  if (lower.includes("no pg_hba.conf entry")) {
    return "Acesso bloqueado (pg_hba.conf). Contate o DBA.";
  }
  if (lower.includes("role") && lower.includes("does not exist")) {
    return "Usuário não existe no banco.";
  }
  if (lower.includes("ssh") || lower.includes("tunnel")) {
    return `Falha no SSH tunnel: ${raw.slice(0, 120)}`;
  }
  return raw.slice(0, 200);
}

/** Executa `fn` dentro de transação; rollback em erro. */
export async function withTransaction<T>(
  conn: OpenConnection,
  fn: (q: Queryable) => Promise<T>,
): Promise<T> {
  await conn.query("BEGIN");
  try {
    const result = await fn(conn);
    await conn.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await conn.query("ROLLBACK");
    } catch {
      // conexão pode ter caído; o erro original é o que importa
    }
    throw err;
  }
}
