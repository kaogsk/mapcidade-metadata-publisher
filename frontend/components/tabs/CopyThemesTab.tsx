"use client";

import { useState } from "react";
import { api, ApiError, isExecuted } from "@/lib/api";
import type {
  CopyThemeEntry,
  CopyThemesInput,
  MapFolder,
  Profile,
  StatementPreview,
  Theme,
} from "@/lib/types";
import { useConnection } from "@/components/ConnectionContext";
import { ConfirmExecute } from "@/components/ConfirmExecute";
import { LogPanel } from "@/components/LogPanel";
import { SqlPreview } from "@/components/SqlPreview";
import { Alert, Button, Field, Panel, Select } from "@/components/ui";

export function CopyThemesTab() {
  const { connection } = useConnection();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [maps, setMaps] = useState<MapFolder[]>([]);
  const [sourcePrf, setSourcePrf] = useState("");
  const [destPrf, setDestPrf] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [parentMap, setParentMap] = useState("");

  const [dryThemes, setDryThemes] = useState<CopyThemeEntry[] | null>(null);
  const [ordenar, setOrdenar] = useState<StatementPreview[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "profiles" | "themes" | "maps" | "preview" | "execute">("");
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  function resetPreview() {
    setDryThemes(null);
    setOrdenar([]);
  }

  async function loadProfiles() {
    setBusy("profiles");
    setMsg(null);
    try {
      const res = await api.listProfiles(connection);
      setProfiles(res.profiles);
      setMsg({ kind: "info", text: `${res.profiles.length} perfil(is) carregado(s).` });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  async function onSourceChange(v: string) {
    setSourcePrf(v);
    setSelectedThemes([]);
    setThemes([]);
    resetPreview();
    if (!v) return;
    setBusy("themes");
    try {
      const res = await api.listThemes(connection, Number(v));
      setThemes(res.themes);
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  async function onDestChange(v: string) {
    setDestPrf(v);
    setParentMap("");
    setMaps([]);
    resetPreview();
    if (!v) return;
    setBusy("maps");
    try {
      const res = await api.listMaps(connection, Number(v));
      setMaps(res.maps);
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  function buildInput(execute: boolean): CopyThemesInput {
    return {
      connection,
      sourcePrfId: Number(sourcePrf),
      destPrfId: Number(destPrf),
      themes: selectedThemes,
      parentMapId: parentMap ? Number(parentMap) : null,
      execute,
      confirm: execute ? "EXECUTAR" : undefined,
    };
  }

  const canRun =
    sourcePrf !== "" && destPrf !== "" && selectedThemes.length > 0 && busy === "";

  async function handlePreview() {
    setBusy("preview");
    setMsg(null);
    resetPreview();
    try {
      const res = await api.copyThemes(buildInput(false));
      if (!isExecuted(res)) {
        setDryThemes(res.themes);
        setOrdenar(res.ordenar);
        setLogs(res.logs);
        const skipped = res.themes.filter((t) => t.skipped).length;
        setMsg({
          kind: "info",
          text: `Dry-run: ${res.themes.length} tema(s)${
            skipped ? `, ${skipped} já existente(s) serão pulados` : ""
          }. Nada foi executado.`,
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
      const res = await api.copyThemes(buildInput(true));
      if (isExecuted(res)) {
        setLogs(res.logs);
        resetPreview();
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
      title="Copiar temas (mesmo banco)"
      subtitle="Copia temas de um perfil de origem para um perfil de destino no mesmo banco."
      icon={<span aria-hidden>📋</span>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={loadProfiles} disabled={busy !== "" || !connection.database}>
            {busy === "profiles" ? "Carregando…" : "Carregar perfis"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Perfil de origem">
            <Select value={sourcePrf} onChange={(e) => void onSourceChange(e.target.value)}>
              <option value="">Selecione…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ID {p.id})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Perfil de destino">
            <Select value={destPrf} onChange={(e) => void onDestChange(e.target.value)}>
              <option value="">Selecione…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ID {p.id})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={`Temas para copiar${selectedThemes.length ? ` (${selectedThemes.length} selecionado(s))` : ""}`}
          hint="Segure Ctrl/Cmd para selecionar vários"
        >
          <Select
            multiple
            size={8}
            value={selectedThemes}
            onChange={(e) => {
              setSelectedThemes(Array.from(e.target.selectedOptions, (o) => o.value));
              resetPreview();
            }}
            className="h-auto"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mapa pai no destino" hint="Opcional — pasta de mapa que agrupará os temas">
          <Select
            value={parentMap}
            onChange={(e) => {
              setParentMap(e.target.value);
              resetPreview();
            }}
          >
            <option value="">Sem mapa pai</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (ID {m.id})
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handlePreview} disabled={!canRun}>
            {busy === "preview" ? "Gerando…" : "Pré-visualizar (dry-run)"}
          </Button>
        </div>

        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

        {dryThemes && (
          <div className="space-y-5 border-t border-gp-bar5/15 pt-5">
            {dryThemes.map((t) => (
              <div key={t.theme} className="space-y-2">
                <div className="flex items-center gap-2 font-display text-[13px] font-bold text-white">
                  <span aria-hidden>🗂️</span> {t.theme}
                  {t.skipped && <span className="gp-chip text-gp-warn">pulado</span>}
                </div>
                {t.skipped ? (
                  <Alert kind="warn">{t.skipped}</Alert>
                ) : (
                  <SqlPreview statements={t.preview} />
                )}
              </div>
            ))}
            <SqlPreview statements={ordenar} title="Reordenação" />
            <LogPanel logs={logs} />
            <ConfirmExecute onExecute={handleExecute} executing={busy === "execute"} />
          </div>
        )}

        {!dryThemes && logs.length > 0 && <LogPanel logs={logs} title="Resultado" />}
      </div>
    </Panel>
  );
}
