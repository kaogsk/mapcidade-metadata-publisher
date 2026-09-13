"use client";

import { useState } from "react";
import { api, ApiError, isExecuted } from "@/lib/api";
import type { CreateThemesInput, StatementPreview, TableRef } from "@/lib/types";
import { useConnection } from "@/components/ConnectionContext";
import { ConfirmExecute } from "@/components/ConfirmExecute";
import { LogPanel } from "@/components/LogPanel";
import { SqlPreview } from "@/components/SqlPreview";
import { Alert, Button, Field, Input, Panel, Textarea } from "@/components/ui";

export function CreateThemesTab() {
  const { connection } = useConnection();
  const [form, setForm] = useState({
    tablesRaw: "",
    prfId: 1,
    mapParentName: "",
    workspace: "",
    geoserverBase: "",
    urlBanco: "",
  });
  const [tables, setTables] = useState<TableRef[] | null>(null);
  const [preview, setPreview] = useState<StatementPreview[] | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "tables" | "preview" | "execute">("");
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function buildInput(execute: boolean): CreateThemesInput {
    return {
      connection,
      tablesRaw: form.tablesRaw,
      prfId: Number(form.prfId),
      mapParentName: form.mapParentName,
      workspace: form.workspace,
      geoserverBase: form.geoserverBase,
      urlBanco: form.urlBanco,
      execute,
      confirm: execute ? "EXECUTAR" : undefined,
    };
  }

  async function handleListTables() {
    setBusy("tables");
    setMsg(null);
    try {
      const res = await api.listTables(connection);
      setTables(res.tables);
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  async function handlePreview() {
    setBusy("preview");
    setMsg(null);
    setPreview(null);
    try {
      const res = await api.createThemes(buildInput(false));
      if (!isExecuted(res)) {
        setPreview(res.preview);
        setLogs(res.logs);
        setMsg({
          kind: "info",
          text: `Dry-run: ${res.preview.length} statement(s). Nada foi executado.`,
        });
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
      const res = await api.createThemes(buildInput(true));
      if (isExecuted(res)) {
        setLogs(res.logs);
        setPreview(null);
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
      title="Criar temas"
      subtitle="Gera temas (e camadas/mapa quando houver mapa pai) a partir de tabelas/views."
      icon={<span aria-hidden>➕</span>}
    >
      <div className="space-y-5">
        <Field
          label="Tabelas / views (separadas por vírgula)"
          hint="Ex.: rivermeadow_gis.parcel, rivermeadow_gis.block"
        >
          <Textarea
            rows={3}
            value={form.tablesRaw}
            onChange={(e) => set("tablesRaw", e.target.value)}
            placeholder="schema.tabela1, schema.tabela2"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="PRF_ID (perfil)">
            <Input
              type="number"
              value={form.prfId}
              onChange={(e) => set("prfId", Number(e.target.value))}
            />
          </Field>
          <Field
            label="Nome do mapa pai"
            hint="Vazio = tema tabular (sem map_node/map_param)"
          >
            <Input
              value={form.mapParentName}
              onChange={(e) => set("mapParentName", e.target.value)}
              placeholder="Camadas Disponíveis"
            />
          </Field>
          <Field label="Workspace">
            <Input
              value={form.workspace}
              onChange={(e) => set("workspace", e.target.value)}
              placeholder="rivermeadow_gis"
            />
          </Field>
          <Field label="Base GeoServer">
            <Input
              value={form.geoserverBase}
              onChange={(e) => set("geoserverBase", e.target.value)}
              placeholder="/geoserver/rivermeadow_gis/wms"
            />
          </Field>
          <Field label="URL do banco" className="sm:col-span-2">
            <Input
              value={form.urlBanco}
              onChange={(e) => set("urlBanco", e.target.value)}
              placeholder="(opcional) URL de conexão do banco no console"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={handleListTables} disabled={busy !== ""}>
            {busy === "tables" ? "Listando…" : "Listar tabelas"}
          </Button>
          <Button onClick={handlePreview} disabled={busy !== "" || !form.tablesRaw.trim()}>
            {busy === "preview" ? "Gerando…" : "Pré-visualizar (dry-run)"}
          </Button>
        </div>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        {tables && (
          <div className="rounded-xl border border-gp-bar5/15 bg-gp-abyss/50 p-3">
            <div className="mb-2 font-display text-[12px] font-bold uppercase tracking-wide text-gp-bar5">
              {tables.length} tabela(s) disponíveis
            </div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {tables.map((t) => (
                <button
                  key={`${t.schema}.${t.name}`}
                  type="button"
                  className="gp-chip hover:border-gp-bar4/60 hover:text-gp-lightgray"
                  onClick={() =>
                    set(
                      "tablesRaw",
                      form.tablesRaw
                        ? `${form.tablesRaw}, ${t.schema}.${t.name}`
                        : `${t.schema}.${t.name}`,
                    )
                  }
                  title="Adicionar à lista de tabelas"
                >
                  {t.schema}.{t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-4 border-t border-gp-bar5/15 pt-5">
            <SqlPreview statements={preview} title="Plano (dry-run)" />
            <LogPanel logs={logs} />
            <ConfirmExecute onExecute={handleExecute} executing={busy === "execute"} />
          </div>
        )}

        {!preview && logs.length > 0 && <LogPanel logs={logs} title="Resultado" />}
      </div>
    </Panel>
  );
}
