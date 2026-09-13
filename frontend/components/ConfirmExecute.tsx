"use client";

import { useState } from "react";
import { CONFIRM_PHRASE } from "@/lib/types";
import { Button, Input } from "./ui";

/**
 * Bloco de confirmação da execução real. Só aparece depois de um dry-run
 * bem-sucedido; habilita o botão "Executar de verdade" apenas quando o
 * operador digita exatamente EXECUTAR (mesmo contrato do backend).
 */
export function ConfirmExecute({
  onExecute,
  executing,
  disabled,
}: {
  onExecute: () => void;
  executing: boolean;
  disabled?: boolean;
}) {
  const [phrase, setPhrase] = useState("");
  const armed = phrase.trim() === CONFIRM_PHRASE;

  return (
    <div className="rounded-xl border border-gp-warn/40 bg-gp-warn/[0.07] p-4">
      <div className="mb-1 flex items-center gap-2 font-display text-[13.5px] font-bold text-gp-warn">
        <span aria-hidden>⚠</span> Zona de execução real
      </div>
      <p className="mb-3 font-body text-[12.5px] text-[#f2cbb6]">
        Isto escreve nas tabelas centrais do banco. Confira o plano acima. Para liberar, digite{" "}
        <code className="rounded bg-gp-abyss/60 px-1.5 py-0.5 font-mono text-gp-warn">
          {CONFIRM_PHRASE}
        </code>{" "}
        no campo abaixo.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={`Digite ${CONFIRM_PHRASE}`}
          spellCheck={false}
          autoComplete="off"
          className="sm:max-w-xs"
          aria-label="Confirmação de execução"
        />
        <Button
          variant="danger"
          onClick={onExecute}
          disabled={!armed || executing || disabled}
        >
          {executing ? "Executando…" : "Executar de verdade"}
        </Button>
      </div>
    </div>
  );
}
