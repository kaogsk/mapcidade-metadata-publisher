"use client";

/** Área de logs devolvida pelo backend (plan.logs). */
export function LogPanel({ logs, title = "Logs" }: { logs: string[]; title?: string }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 font-display text-[12.5px] font-bold uppercase tracking-wide text-gp-bar5">
        {title}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gp-bar5/15 bg-gp-abyss/60 p-3 font-mono text-[12px] leading-relaxed text-gp-darkgray">
        {logs.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            <span className="mr-2 select-none text-gp-teal/60">›</span>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
