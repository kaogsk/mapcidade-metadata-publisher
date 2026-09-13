"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useConnection } from "@/components/ConnectionContext";
import { Alert, Button, Field, Input, Panel } from "@/components/ui";

export function CertificateTab() {
  const { connection } = useConnection();
  const [tblId, setTblId] = useState("");
  const [json, setJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleGenerate() {
    setBusy(true);
    setMsg(null);
    setJson(null);
    try {
      const res = await api.certificate(connection, Number(tblId));
      setJson(res.json);
      setMsg({ kind: "success", text: "Certidão gerada." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <Panel
      title="Certidão JSON"
      subtitle="Gera o JSON de certidão (read-only) a partir dos atributos de um tema (tbl_id)."
      icon={<span aria-hidden>📄</span>}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="tbl_id do tema" className="sm:max-w-xs sm:flex-1">
            <Input
              type="number"
              value={tblId}
              onChange={(e) => setTblId(e.target.value)}
              placeholder="ex.: 1234"
            />
          </Field>
          <Button onClick={handleGenerate} disabled={busy || !tblId || !connection.database}>
            {busy ? "Gerando…" : "Gerar certidão"}
          </Button>
        </div>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        {json && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[12.5px] font-bold uppercase tracking-wide text-gp-bar5">
                JSON gerado
              </span>
              <Button variant="ghost" onClick={handleCopy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <pre className="max-h-[28rem] overflow-auto rounded-xl border border-gp-bar5/18 bg-gp-abyss/60 p-4 font-mono text-[12px] leading-relaxed text-gp-offwhite">
              <code>{json}</code>
            </pre>
          </div>
        )}
      </div>
    </Panel>
  );
}
