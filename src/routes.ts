/**
 * Rotas Express. TODA escrita é dry-run por padrão: o endpoint devolve o
 * preview do(s) plano(s) e só executa se `execute:true` + `confirm:"EXECUTAR"`.
 */
import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import {
  openConnection,
  testConnection,
  friendlyError,
  withTransaction,
} from "./db/connection.js";
import {
  assertConfirmed,
  ConfirmationError,
  certificateSchema,
  connectionSchema,
  copyThemesSchema,
  createThemesSchema,
  listThemesSchema,
  transferSchema,
} from "./schemas.js";
import { buildCreateThemesPlan } from "./services/metadata.js";
import { buildCopyThemesPlans } from "./services/copy.js";
import {
  buildDdlPlan,
  buildDataPlan,
  buildTransferMetadataPlan,
} from "./services/transfer.js";
import { generateCertificateJson } from "./services/certificate.js";
import {
  listProfiles,
  listThemes,
  listMapFolders,
  listTables,
} from "./services/lookups.js";
import { executePlan, renderPreview, emptyPlan, type Plan } from "./sqlPlan.js";
import {
  loadLastConnection,
  saveLastConnection,
  redact,
  type StoredConnection,
} from "./lastConnection.js";

export interface RouterDeps {
  lastConnectionFile: string;
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: "Payload inválido", issues: err.issues });
    return;
  }
  if (err instanceof ConfirmationError) {
    res.status(409).json({ success: false, error: err.message });
    return;
  }
  res.status(500).json({ success: false, error: friendlyError(err) });
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "mapcidade-metadata-publisher" });
  });

  // ─── Config persistida ───────────────────────────────────────────────────
  router.get("/config", (_req: Request, res: Response) => {
    const cfg = loadLastConnection(deps.lastConnectionFile);
    res.json({ success: true, config: redact(cfg) });
  });

  router.post("/config", (req: Request, res: Response) => {
    try {
      saveLastConnection(deps.lastConnectionFile, req.body as StoredConnection);
      res.json({ success: true, message: "Configuração salva." });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ─── Conexão ─────────────────────────────────────────────────────────────
  router.post("/test-connection", async (req: Request, res: Response) => {
    try {
      const cfg = connectionSchema.parse(req.body);
      const result = await testConnection(cfg);
      res.json({ success: result.ok, message: result.message });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ─── Lookups (read-only) ─────────────────────────────────────────────────
  router.post("/list-tables", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const cfg = connectionSchema.parse(req.body);
      conn = await openConnection(cfg);
      res.json({ success: true, tables: await listTables(conn) });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  router.post("/list-profiles", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const cfg = connectionSchema.parse(req.body);
      conn = await openConnection(cfg);
      res.json({ success: true, profiles: await listProfiles(conn) });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  router.post("/list-themes", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const { connection, prfId } = listThemesSchema.parse(req.body);
      conn = await openConnection(connection);
      res.json({ success: true, themes: await listThemes(conn, prfId) });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  router.post("/list-maps", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const { connection, prfId } = listThemesSchema.parse(req.body);
      conn = await openConnection(connection);
      res.json({ success: true, maps: await listMapFolders(conn, prfId) });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  // ─── Criar temas (escrita, dry-run por padrão) ───────────────────────────
  router.post("/create-themes", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const input = createThemesSchema.parse(req.body);
      assertConfirmed(input);
      conn = await openConnection(input.connection);
      const plan = await buildCreateThemesPlan(conn, input);

      if (!input.execute) {
        res.json({ success: true, dryRun: true, preview: renderPreview(plan), logs: plan.logs });
        return;
      }

      const executed = await withTransaction(conn, (q) =>
        executePlan(q, plan, (m) => plan.logs.push(m)),
      );
      res.json({ success: true, dryRun: false, executed: executed.length, logs: plan.logs });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  // ─── Copiar temas (mesmo banco; escrita, dry-run por padrão) ─────────────
  router.post("/copy-themes", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const input = copyThemesSchema.parse(req.body);
      assertConfirmed(input);
      conn = await openConnection(input.connection);
      const plans = await buildCopyThemesPlans(
        conn,
        input.sourcePrfId,
        input.destPrfId,
        input.themes,
        input.parentMapId,
      );

      const logs: string[] = [];
      const previews = plans.themes.map((t) => {
        logs.push(...t.plan.logs);
        return {
          theme: t.themeName,
          skipped: t.skipped ?? null,
          preview: renderPreview(t.plan),
        };
      });
      const reorderPreview = renderPreview(plans.reorder);

      if (!input.execute) {
        res.json({
          success: true,
          dryRun: true,
          themes: previews,
          reorder: reorderPreview,
          logs,
        });
        return;
      }

      // Execução: cada tema numa transação própria
      let totalExecuted = 0;
      for (const t of plans.themes) {
        if (t.skipped) {
          logs.push(t.skipped);
          continue;
        }
        const executed = await withTransaction(conn, (q) => executePlan(q, t.plan, (m) => logs.push(m)));
        totalExecuted += executed.length;
      }
      const ordExecuted = await withTransaction(conn, (q) =>
        executePlan(q, plans.reorder, (m) => logs.push(m)),
      );
      totalExecuted += ordExecuted.length;
      res.json({ success: true, dryRun: false, executed: totalExecuted, logs });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  // ─── Transferir entre bancos (escrita no destino, dry-run por padrão) ────
  router.post("/transfer", async (req: Request, res: Response) => {
    let src = null;
    let tgt = null;
    try {
      const input = transferSchema.parse(req.body);
      assertConfirmed(input);
      src = await openConnection(input.source);
      tgt = await openConnection(input.target);

      const overrides = {
        tableName: input.tableName,
        urlBanco: input.urlBanco,
        workspace: input.workspace,
        geoserverBase: input.geoserverBase,
      };

      const ddlPlan: Plan = input.copyDdl ? await buildDdlPlan(src, input.tableName) : emptyPlan();
      const dataPlan: Plan = input.copyData
        ? await buildDataPlan(src, input.tableName)
        : emptyPlan();
      const metaPlan: Plan = input.copyMetadata
        ? await buildTransferMetadataPlan(
            src,
            tgt,
            input.sourcePrfId,
            input.tableName,
            input.destPrfId,
            input.destParentMapId,
            overrides,
          )
        : emptyPlan();

      const logs = [...ddlPlan.logs, ...dataPlan.logs, ...metaPlan.logs];

      if (!input.execute) {
        res.json({
          success: true,
          dryRun: true,
          ddl: renderPreview(ddlPlan),
          data: renderPreview(dataPlan),
          metadata: renderPreview(metaPlan),
          logs,
        });
        return;
      }

      // DDL e dados são autocommit no v2 (cada um seu commit); metadados numa transação.
      let executed = 0;
      if (input.copyDdl) executed += (await executePlan(tgt, ddlPlan, (m) => logs.push(m))).length;
      if (input.copyData) executed += (await executePlan(tgt, dataPlan, (m) => logs.push(m))).length;
      if (input.copyMetadata) {
        const done = await withTransaction(tgt, (q) => executePlan(q, metaPlan, (m) => logs.push(m)));
        executed += done.length;
      }
      res.json({ success: true, dryRun: false, executed, logs });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (src) await src.close();
      if (tgt) await tgt.close();
    }
  });

  // ─── Certidão JSON (read-only) ───────────────────────────────────────────
  router.post("/certificate", async (req: Request, res: Response) => {
    let conn = null;
    try {
      const { connection, tblId } = certificateSchema.parse(req.body);
      conn = await openConnection(connection);
      const json = await generateCertificateJson(conn, tblId);
      res.json({ success: true, json });
    } catch (err) {
      handleError(res, err);
    } finally {
      if (conn) await conn.close();
    }
  });

  return router;
}
