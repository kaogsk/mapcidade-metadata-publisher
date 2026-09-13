// Cabeçalho de marca — PixelMark em grade de pixels, wordmark "MapCidade ·
// Metadata Publisher", ribbon de acento no topo. FIXO ao rolar.

export function Brand({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50">
      <div className="accent-ribbon" />
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-b border-gp-navy px-6 py-4 backdrop-blur-md md:px-10"
        style={{
          background: "linear-gradient(180deg, rgba(16,35,63,0.92), rgba(16,35,63,0.72))",
        }}
      >
        <div className="flex items-center gap-4">
          <span className="rounded-[13px]">
            <PixelMark />
          </span>
          <div className="leading-none">
            <h1 className="flex flex-wrap items-baseline gap-2 font-display text-lg font-bold tracking-tight md:text-xl">
              <span className="inline-flex items-baseline">
                <span className="font-medium text-gp-lightgray">Map</span>
                <span className="font-bold text-gp-bar4">Cidade</span>
              </span>
              <span className="font-light text-gp-darkgray">·</span>
              <span className="font-bold text-white">Metadata Publisher</span>
            </h1>
            <p className="mt-1 font-body text-[12.5px] text-gp-darkgray">
              Publicar, copiar e transferir metadados de temas no console
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{right}</div>
      </div>
    </header>
  );
}

// Marca inline (grade de pixels) — sem dependência de asset externo.
function PixelMark() {
  const cells = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [2, 1],
    [0, 2], [1, 2], [2, 2],
  ];
  return (
    <span
      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[13px] border border-gp-navy"
      style={{ boxShadow: "inset 0 0 20px rgba(72,156,213,0.08)" }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" aria-label="MapCidade" role="img">
        {cells.map(([x, y]) => (
          <rect
            key={`${String(x)}-${String(y)}`}
            x={x * 10 + 1}
            y={y * 10 + 1}
            width="8"
            height="8"
            rx="1.5"
            fill="#489CD5"
          />
        ))}
      </svg>
    </span>
  );
}
