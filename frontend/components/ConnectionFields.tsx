"use client";

import type { Connection, SshConfig } from "@/lib/types";
import { emptySsh } from "@/lib/defaults";
import { Field, Input } from "./ui";

/** Campos de uma conexão Postgres (+ túnel SSH opcional). Controlado. */
export function ConnectionFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Connection;
  onChange: (c: Connection) => void;
  idPrefix: string;
}) {
  const set = <K extends keyof Connection>(key: K, v: Connection[K]) =>
    onChange({ ...value, [key]: v });

  const setSsh = <K extends keyof SshConfig>(key: K, v: SshConfig[K]) =>
    onChange({ ...value, ssh: { ...(value.ssh ?? emptySsh()), [key]: v } });

  const useTunnel = value.ssh !== undefined;
  const toggleTunnel = (on: boolean) =>
    onChange({ ...value, ssh: on ? value.ssh ?? emptySsh() : undefined });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Host do banco">
          <Input
            id={`${idPrefix}-host`}
            value={value.host}
            onChange={(e) => set("host", e.target.value)}
            placeholder="localhost"
          />
        </Field>
        <Field label="Porta">
          <Input
            id={`${idPrefix}-port`}
            type="number"
            value={value.port}
            onChange={(e) => set("port", Number(e.target.value))}
            placeholder="5432"
          />
        </Field>
        <Field label="Nome do banco" className="sm:col-span-2">
          <Input
            id={`${idPrefix}-database`}
            value={value.database}
            onChange={(e) => set("database", e.target.value)}
            placeholder="nome_do_banco_municipal"
          />
        </Field>
        <Field label="Usuário">
          <Input
            id={`${idPrefix}-user`}
            value={value.user}
            onChange={(e) => set("user", e.target.value)}
            placeholder="postgres"
          />
        </Field>
        <Field label="Senha">
          <Input
            id={`${idPrefix}-password`}
            type="password"
            value={value.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="••••••••"
            autoComplete="off"
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 font-body text-[13px] text-gp-lightgray">
        <input
          type="checkbox"
          checked={useTunnel}
          onChange={(e) => toggleTunnel(e.target.checked)}
          className="h-4 w-4 accent-gp-teal"
        />
        Usar túnel SSH
      </label>

      {useTunnel && value.ssh && (
        <div className="animate-fade-up rounded-xl border border-gp-bar5/15 bg-gp-abyss/40 p-4">
          <div className="mb-3 font-display text-[12.5px] font-bold uppercase tracking-wide text-gp-bar5">
            Túnel SSH
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="SSH host">
              <Input
                value={value.ssh.host}
                onChange={(e) => setSsh("host", e.target.value)}
                placeholder="servidor.ssh.com"
              />
            </Field>
            <Field label="SSH porta">
              <Input
                type="number"
                value={value.ssh.port}
                onChange={(e) => setSsh("port", Number(e.target.value))}
                placeholder="22"
              />
            </Field>
            <Field label="SSH usuário">
              <Input
                value={value.ssh.user}
                onChange={(e) => setSsh("user", e.target.value)}
                placeholder="usuario"
              />
            </Field>
            <Field label="SSH senha">
              <Input
                type="password"
                value={value.ssh.password}
                onChange={(e) => setSsh("password", e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
              />
            </Field>
            <Field label="Caminho da chave privada" hint="Alternativa à senha (opcional)">
              <Input
                value={value.ssh.privateKeyPath}
                onChange={(e) => setSsh("privateKeyPath", e.target.value)}
                placeholder="/home/user/.ssh/id_rsa"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Postgres remoto (host)">
                <Input
                  value={value.ssh.remoteHost}
                  onChange={(e) => setSsh("remoteHost", e.target.value)}
                  placeholder="127.0.0.1"
                />
              </Field>
              <Field label="Porta">
                <Input
                  type="number"
                  value={value.ssh.remotePort}
                  onChange={(e) => setSsh("remotePort", Number(e.target.value))}
                  placeholder="5432"
                />
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
