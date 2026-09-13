"use client";

import type { StatementPreview } from "@/lib/types";

/** Renderiza o SQL do plano (dry-run) com destaque — o operador confere antes de executar. */
export function SqlPreview({
  statements,
  title,
}: {
  statements: StatementPreview[];
  title?: string;
}) {
  if (!statements || statements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gp-bar5/20 bg-gp-abyss/40 px-3.5 py-3 font-body text-[12.5px] text-gp-darkgray">
        {title ? `${title}: ` : ""}nenhum statement neste plano.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {title && (
        <div className="flex items-center gap-2 font-display text-[12.5px] font-bold uppercase tracking-wide text-gp-bar5">
          {title}
          <span className="gp-chip">{statements.length} statement(s)</span>
        </div>
      )}
      <ol className="space-y-2.5">
        {statements.map((st, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-gp-bar5/18 bg-gp-abyss/55"
          >
            <div className="flex items-center gap-2 border-b border-gp-bar5/12 bg-gp-navy/40 px-3.5 py-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gp-teal/25 font-mono text-[11px] font-bold text-gp-bar5">
                {i + 1}
              </span>
              <span className="font-body text-[12.5px] font-semibold text-gp-lightgray">
                {st.purpose}
              </span>
            </div>
            <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-gp-offwhite">
              <code>{st.sql}</code>
            </pre>
            {st.params && st.params.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-gp-bar5/12 px-3.5 py-2">
                <span className="font-body text-[11px] font-semibold text-gp-darkgray">
                  params:
                </span>
                {st.params.map((p, j) => (
                  <code
                    key={j}
                    className="rounded bg-gp-navy/60 px-1.5 py-0.5 font-mono text-[11px] text-gp-bar5"
                  >
                    ${j + 1} = {formatParam(p)}
                  </code>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatParam(p: unknown): string {
  if (p === null || p === undefined) return "null";
  if (typeof p === "string") return p.length > 60 ? `${p.slice(0, 57)}…` : p;
  return String(p);
}
