/** Persistência da última conexão usada (arquivo local .mapcidade_last_connection.json). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export interface StoredConnection {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssh?: Record<string, unknown>;
}

const SECRET_KEYS = ["password"];

export function loadLastConnection(file: string): StoredConnection {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as StoredConnection;
  } catch {
    return {};
  }
}

export function saveLastConnection(file: string, cfg: StoredConnection): void {
  writeFileSync(file, JSON.stringify(cfg, null, 2), "utf-8");
}

/** Redige segredos para devolver ao frontend sem vazar senhas. */
export function redact(cfg: StoredConnection): StoredConnection {
  const clone: StoredConnection = { ...cfg };
  for (const k of SECRET_KEYS) {
    if (k in clone && (clone as Record<string, unknown>)[k]) {
      (clone as Record<string, unknown>)[k] = "***";
    }
  }
  if (clone.ssh && typeof clone.ssh === "object") {
    const ssh = { ...clone.ssh };
    if (ssh.password) ssh.password = "***";
    clone.ssh = ssh;
  }
  return clone;
}
