/**
 * Cliente de API tipado do Publicador de Metadados.
 * Destino do backend por env: NEXT_PUBLIC_API_BASE (default same-origin "/api").
 * Todas as rotas de escrita são dry-run por padrão; execução real exige
 * `execute:true` + `confirm:"EXECUTAR"` (ver types.CONFIRM_PHRASE).
 */
import type {
  ApiErr,
  CertificateResponse,
  ConfigResponse,
  Connection,
  CopyThemesDryRun,
  CopyThemesInput,
  CreateThemesDryRun,
  CreateThemesInput,
  MapFolder,
  Profile,
  StoredConnection,
  Theme,
  TableRef,
  TestConnectionResponse,
  TransferDryRun,
  TransferInput,
  WriteExecuted,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

/** Erro de API com o corpo desestruturado para exibição na UI. */
export class ApiError extends Error {
  status: number;
  body: ApiErr | undefined;
  constructor(message: string, status: number, body?: ApiErr) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const parsed: unknown = await res.json().catch(() => ({}));
  const data = parsed as ApiErr & Record<string, unknown>;

  if (!res.ok || data.success === false) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `Falha na API (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return parsed as T;
}

export const api = {
  health: () => request<{ status: string; service: string }>("/health"),

  // ── Config persistida ──────────────────────────────────────────────
  getConfig: () => request<ConfigResponse>("/config"),
  saveConfig: (config: StoredConnection) =>
    request<{ success: true; message: string }>("/config", config),

  // ── Conexão ────────────────────────────────────────────────────────
  testConnection: (connection: Connection) =>
    request<TestConnectionResponse>("/test-connection", connection),

  // ── Lookups (read-only) ────────────────────────────────────────────
  listTables: (connection: Connection) =>
    request<{ success: true; tables: TableRef[] }>("/list-tables", connection),
  listProfiles: (connection: Connection) =>
    request<{ success: true; profiles: Profile[] }>("/list-profiles", connection),
  listThemes: (connection: Connection, prfId: number) =>
    request<{ success: true; themes: Theme[] }>("/list-themes", { connection, prfId }),
  listMaps: (connection: Connection, prfId: number) =>
    request<{ success: true; maps: MapFolder[] }>("/list-maps", { connection, prfId }),

  // ── Escrita (dry-run por padrão) ───────────────────────────────────
  createThemes: (input: CreateThemesInput) =>
    request<CreateThemesDryRun | WriteExecuted>("/create-themes", input),
  copyThemes: (input: CopyThemesInput) =>
    request<CopyThemesDryRun | WriteExecuted>("/copy-themes", input),
  transfer: (input: TransferInput) =>
    request<TransferDryRun | WriteExecuted>("/transfer", input),

  // ── Certidão JSON (read-only) ──────────────────────────────────────
  certificate: (connection: Connection, tblId: number) =>
    request<CertificateResponse>("/certificate", { connection, tblId }),
};

/** Type guard: resposta de escrita foi execução real (não dry-run). */
export function isExecuted(
  r: { dryRun?: boolean } | WriteExecuted,
): r is WriteExecuted {
  return r.dryRun === false;
}
