import { z } from "zod";

/** Config de túnel SSH — espelha o sshtunnel do Python (chave → senha → agente). */
export const sshConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(22),
  user: z.string().min(1),
  password: z.string().default(""),
  privateKeyPath: z.string().default(""),
  /** Host/porta do Postgres visto DE DENTRO do servidor SSH. */
  remoteHost: z.string().default("127.0.0.1"),
  remotePort: z.coerce.number().int().positive().default(5432),
});

export const connectionSchema = z.object({
  host: z.string().default("localhost"),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().min(1, "Informe o nome do banco"),
  user: z.string().default("postgres"),
  password: z.string().default(""),
  ssh: sshConfigSchema.optional(),
});

export type ConnectionInput = z.infer<typeof connectionSchema>;
export type SshInput = z.infer<typeof sshConfigSchema>;

/** Gate de execução: dry-run por padrão; escrita real exige confirmação explícita. */
export const executeGateSchema = z.object({
  execute: z.boolean().default(false),
  confirm: z.string().optional(),
});

export const CONFIRM_PHRASE = "EXECUTAR";

export function assertConfirmed(gate: { execute: boolean; confirm?: string | undefined }): void {
  if (gate.execute && gate.confirm !== CONFIRM_PHRASE) {
    throw new ConfirmationError(
      `Execução real exige confirm: "${CONFIRM_PHRASE}". Rode sem execute para ver o dry-run.`,
    );
  }
}

export class ConfirmationError extends Error {}

export const createThemesSchema = executeGateSchema.extend({
  connection: connectionSchema,
  /** Tabelas/views separadas por vírgula (mesmo TABLES_RAW do Python). */
  tablesRaw: z.string().min(1, "Informe ao menos uma tabela"),
  prfId: z.coerce.number().int(),
  /** Vazio => tema tabular (sem map_node/map_param). */
  mapParentName: z.string().default(""),
  workspace: z.string().default(""),
  geoserverBase: z.string().default(""),
  urlBanco: z.string().default(""),
});

export const copyThemesSchema = executeGateSchema.extend({
  connection: connectionSchema,
  sourcePrfId: z.coerce.number().int(),
  destPrfId: z.coerce.number().int(),
  themes: z.array(z.string().min(1)).min(1, "Selecione ao menos um tema"),
  parentMapId: z.coerce.number().int().nullable().default(null),
});

export const transferSchema = executeGateSchema.extend({
  source: connectionSchema,
  target: connectionSchema,
  tableName: z.string().min(1, "Informe o nome da tabela/tema"),
  sourcePrfId: z.coerce.number().int(),
  destPrfId: z.coerce.number().int(),
  destParentMapId: z.coerce.number().int().nullable().default(null),
  workspace: z.string().default(""),
  geoserverBase: z.string().default(""),
  urlBanco: z.string().default(""),
  copyDdl: z.boolean().default(true),
  copyData: z.boolean().default(false),
  copyMetadata: z.boolean().default(true),
});

export const listThemesSchema = z.object({
  connection: connectionSchema,
  prfId: z.coerce.number().int(),
});

export const certificateSchema = z.object({
  connection: connectionSchema,
  tblId: z.coerce.number().int(),
});
