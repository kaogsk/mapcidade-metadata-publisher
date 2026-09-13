"use client";

import { useState } from "react";
import { api, ApiError, isExecuted } from "@/lib/api";
import type { Connection, StatementPreview, TransferInput } from "@/lib/types";
import { emptyConnection } from "@/lib/defaults";
import { useConnection } from "@/components/ConnectionContext";
import { ConnectionFields } from "@/components/ConnectionFields";
import { ConfirmExecute } from "@/components/ConfirmExecute";
import { LogPanel } from "@/components/LogPanel";
import { SqlPreview } from "@/components/SqlPreview";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

export function TransferTab() {
  const { connection } = useConnection();
  const [source, setSource] = useState<Connection>(connection);
  const [target, setTarget] = useState<Connection>(emptyConnection());
  const [form, setForm] = useState({
    tableName: "",
    sourcePrfId: 1,
    destPrfId: 1,
    destParentMapId: "",
    workspace: "",
    geoserverBase: "",
    urlBanco: "",
    copyDdl: true,
    copyData: false,
    copyMetadata: true,
  });

  const [dry, setDry] = useState<{
    ddl: StatementPreview[];
    data: StatementPreview[];
    metadata: StatementPreview[];
  } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "preview" | "execute" | "sync">("");
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDry(null);
  };

  function buildInput(execute: boolean): TransferInput {
    return {
      source,
      target,
      tableName: form.tableName,
      sourcePrfId: Number(form.sourcePrfId),
      destPrfId: Number(form.destPrfId),
      destParentMapId: form.destParentMapId ? Number(form.destParentMapId) : null,
      workspace: form.workspace,
      geoserverBase: form.geoserverBase,
      urlBanco: form.urlBanco,
      copyDdl: form.copyDdl,
      copyData: form.copyData,
      copyMetadata: form.copyMetadata,
      execute,
      confirm: execute ? "EXECUTAR" : undefined,
    };
  }

  async function handlePreview() {
    setBusy("preview");
    setMsg(null);
    setDry(null);
    try {
      const res = await api.transfer(buildInput(false));
      if (!isExecuted(res)) {
        setDry({ ddl: res.ddl, data: res.data, metadata: res.metadata });
        setLogs(res.logs);
        const total = res.ddl.length + res.data.length + res.metadata.length;
        setMsg({ kind: "info", text: `Dry-run: ${total} statement(s) no total. Nada foi executado.` });
      }
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  async function handleExecute() {
    setBusy("execute");
    setMsg(null);
    try {
      const res = await api.transfer(buildInput(true));
      if (isExecuted(res)) {
        setLogs(res.logs);
        setDry(null);
        setMsg({ kind: "success", text: `Executado: ${res.executed} statement(s) aplicados.` });
      }
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel
      title="Transferir entre bancos"
      subtitle="Copia DDL, dados e/ou metadados de um tema do banco de origem para o de destino."
      icon={<span aria-hidden>🔀</span>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-gp-bar5/15 bg-gp-abyss/30 p-4">
            <div className="mb-3 flex items-center gap-2 font-display text-[13px] font-bold text-gp-bar5">
              <span aria-hidden>📤</span> Banco de origem
            </div>
            <ConnectionFields value={source} onChange={setSource} idPrefix="src" />
          </div>
          <div className="rounded-xl border border-gp-warn/25 bg-gp-abyss/30 p-4">
            <div className="mb-3 flex items-center gap-2 font-display text-[13px] font-bold text-gp-warn">
              <span aria-hidden>📥</span> Banco de destino (recebe a escrita)
            </div>
            <ConnectionFields value={target} onChange={setTarget} idPrefix="tgt" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tabela / tema" className="sm:col-span-2">
            <Input
              value={form.tableName}
              onChange={(e) => set("tableName", e.target.value)}
              placeholder="nome_da_tabela_ou_tema"
            />
          </Field>
          <Field label="PRF_ID origem">
            <Input
              type="number"
              value={form.sourcePrfId}
              onChange={(e) => set("sourcePrfId", Number(e.target.value))}
            />
          </Field>
          <Field label="PRF_ID destino">
            <Input
              type="number"
              value={form.destPrfId}
              onChange={(e) => set("destPrfId", Number(e.target.value))}
            />
          </Field>
          <Field label="Mapa pai no destino (map_id)" hint="Opcional">
            <Input
              type="number"
              value={form.destParentMapId}
              onChange={(e) => set("destParentMapId", e.target.value)}
              placeholder="(nenhum)"
            />
          </Field>
          <Field label="Workspace">
            <Input value={form.workspace} onChange={(e) => set("workspace", e.target.value)} />
          </Field>
          <Field label="Base GeoServer">
            <Input
              value={form.geoserverBase}
              onChange={(e) => set("geoserverBase", e.target.value)}
            />
          </Field>
          <Field label="URL do banco">
            <Input value={form.urlBanco} onChange={(e) => set("urlBanco", e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          {(
            [
              ["copyDdl", "Copiar DDL"],
              ["copyData", "Copiar dados"],
              ["copyMetadata", "Copiar metadados"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 font-body text-[13px] text-gp-lightgray"
            >
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="h-4 w-4 accent-gp-teal"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handlePreview}
            disabled={busy !== "" || !form.tableName.trim() || !target.database}
          >
            {busy === "preview" ? "Gerando…" : "Pré-visualizar (dry-run)"}
          </Button>
        </div>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        {dry && (
          <div className="space-y-4 border-t border-gp-bar5/15 pt-5">
            <SqlPreview statements={dry.ddl} title="DDL" />
            <SqlPreview statements={dry.data} title="Dados" />
            <SqlPreview statements={dry.metadata} title="Metadados" />
            <LogPanel logs={logs} />
            <ConfirmExecute onExecute={handleExecute} executing={busy === "execute"} />
          </div>
        )}

        {!dry && logs.length > 0 && <LogPanel logs={logs} title="Resultado" />}
      </div>
    </Panel>
  );
}
