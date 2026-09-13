/**
 * Tipos do contrato da API do backend Express (src/schemas.ts).
 * Mantidos em sincronia manual com os schemas zod do backend.
 */

export interface SshConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  privateKeyPath: string;
  /** Host/porta do Postgres visto DE DENTRO do servidor SSH. */
  remoteHost: string;
  remotePort: number;
}

export interface Connection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssh?: SshConfig;
}

/** Corpo persistido/redigido devolvido por GET /config. */
export interface StoredConnection {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssh?: Partial<SshConfig>;
}

// ── Lookups (read-only) ──────────────────────────────────────────────
export interface Profile {
  id: number;
  name: string;
}
export interface Theme {
  id: number;
  name: string;
}
export interface MapFolder {
  id: number;
  name: string;
}
export interface TableRef {
  schema: string;
  name: string;
}

// ── Preview do plano SQL (sqlPlan.renderPreview) ─────────────────────
export interface StatementPreview {
  purpose: string;
  sql: string;
  params: unknown[];
}

// ── Gate de execução ─────────────────────────────────────────────────
export const CONFIRM_PHRASE = "EXECUTAR";

export interface ExecuteGate {
  execute?: boolean;
  confirm?: string;
}

// ── Payloads de escrita ──────────────────────────────────────────────
export interface CreateThemesInput extends ExecuteGate {
  connection: Connection;
  tablesRaw: string;
  prfId: number;
  mapParentName: string;
  workspace: string;
  geoserverBase: string;
  urlBanco: string;
}

export interface CopyThemesInput extends ExecuteGate {
  connection: Connection;
  sourcePrfId: number;
  destPrfId: number;
  themes: string[];
  parentMapId: number | null;
}

export interface TransferInput extends ExecuteGate {
  source: Connection;
  target: Connection;
  tableName: string;
  sourcePrfId: number;
  destPrfId: number;
  destParentMapId: number | null;
  workspace: string;
  geoserverBase: string;
  urlBanco: string;
  copyDdl: boolean;
  copyData: boolean;
  copyMetadata: boolean;
}

// ── Respostas ────────────────────────────────────────────────────────
export interface ApiOk {
  success: true;
}
export interface ApiErr {
  success: false;
  error?: string;
  message?: string;
  issues?: unknown[];
}

export interface ConfigResponse {
  success: true;
  config: StoredConnection;
}
export interface TestConnectionResponse {
  success: boolean;
  message: string;
}
export interface CreateThemesDryRun {
  success: true;
  dryRun: true;
  preview: StatementPreview[];
  logs: string[];
}
export interface WriteExecuted {
  success: true;
  dryRun: false;
  executed: number;
  logs: string[];
}
export interface CopyThemeEntry {
  theme: string;
  skipped: string | null;
  preview: StatementPreview[];
}
export interface CopyThemesDryRun {
  success: true;
  dryRun: true;
  themes: CopyThemeEntry[];
  ordenar: StatementPreview[];
  logs: string[];
}
export interface TransferDryRun {
  success: true;
  dryRun: true;
  ddl: StatementPreview[];
  data: StatementPreview[];
  metadata: StatementPreview[];
  logs: string[];
}
export interface CertificateResponse {
  success: true;
  json: string;
}
