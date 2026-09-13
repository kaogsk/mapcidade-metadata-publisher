"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { connectionFromStored, passwordRedacted } from "@/lib/defaults";
import { useConnection } from "@/components/ConnectionContext";
import { ConnectionFields } from "@/components/ConnectionFields";
import { Alert, Button, Panel } from "@/components/ui";

export function ConnectionTab() {
  const { connection, setConnection, verified, setVerified } = useConnection();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "info" | "success" | "error" | "warn"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.getConfig();
        if (!alive) return;
        setConnection(connectionFromStored(res.config));
        if (passwordRedacted(res.config)) {
          setMsg({
            kind: "warn",
            text: "Conexão anterior carregada. Redigite a senha — o backend não devolve o segredo salvo.",
          });
        } else {
          setMsg({ kind: "info", text: "Conexão anterior carregada." });
        }
      } catch {
        // Sem config salva ou backend offline — segue com os defaults.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.testConnection(connection);
      if (res.success) {
        setVerified(true);
        setMsg({ kind: "success", text: res.message || "Conexão bem-sucedida." });
      } else {
        setVerified(false);
        setMsg({ kind: "error", text: res.message || "Falha ao conectar." });
      }
    } catch (err) {
      setVerified(false);
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.saveConfig(connection);
      setMsg({ kind: "success", text: res.message || "Configuração salva." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Conexão com o banco municipal"
      subtitle="Defina a conexão Postgres usada por todas as operações. Teste antes de prosseguir."
      icon={<span aria-hidden>🔌</span>}
    >
      <div className="space-y-5">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        {verified && !msg && <Alert kind="success">Conexão verificada.</Alert>}

        <ConnectionFields value={connection} onChange={setConnection} idPrefix="conn" />

        <div className="flex flex-wrap gap-3 pt-1">
          <Button onClick={handleTest} disabled={testing || loading || !connection.database}>
            {testing ? "Testando…" : "Testar conexão"}
          </Button>
          <Button variant="ghost" onClick={handleSave} disabled={saving || !connection.database}>
            {saving ? "Salvando…" : "Salvar configuração"}
          </Button>
        </div>

        <p className="font-body text-[12px] text-gp-darkgray/80">
          A conexão informada aqui é reaproveitada nas telas de Criar, Copiar e Certidão. A tela de
          Transferência define origem e destino próprios.
        </p>
      </div>
    </Panel>
  );
}
