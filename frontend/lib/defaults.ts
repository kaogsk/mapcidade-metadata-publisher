import type { Connection, SshConfig, StoredConnection } from "./types";

export function emptySsh(): SshConfig {
  return {
    host: "",
    port: 22,
    user: "",
    password: "",
    privateKeyPath: "",
    remoteHost: "127.0.0.1",
    remotePort: 5432,
  };
}

export function emptyConnection(): Connection {
  return {
    host: "localhost",
    port: 5432,
    database: "",
    user: "postgres",
    password: "",
  };
}

/**
 * Preenche o formulário de conexão a partir do /config redigido.
 * A senha vem como "***" (redigida) — nunca a reaproveitamos: fica em branco
 * para o operador redigitar (o backend não devolve o segredo real).
 */
export function connectionFromStored(stored: StoredConnection): Connection {
  const base = emptyConnection();
  const conn: Connection = {
    host: stored.host ?? base.host,
    port: stored.port ?? base.port,
    database: stored.database ?? base.database,
    user: stored.user ?? base.user,
    password: stored.password === "***" ? "" : stored.password ?? "",
  };
  if (stored.ssh && Object.keys(stored.ssh).length > 0) {
    const s = stored.ssh;
    conn.ssh = {
      ...emptySsh(),
      ...s,
      password: s.password === "***" ? "" : s.password ?? "",
    };
  }
  return conn;
}

/** true se a senha veio redigida (operador precisa redigitar). */
export function passwordRedacted(stored: StoredConnection): boolean {
  return stored.password === "***" || stored.ssh?.password === "***";
}
