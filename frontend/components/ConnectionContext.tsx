"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Connection } from "@/lib/types";
import { emptyConnection } from "@/lib/defaults";

interface ConnectionCtx {
  connection: Connection;
  setConnection: (c: Connection) => void;
  /** true depois de um teste de conexão OK — libera as demais telas. */
  verified: boolean;
  setVerified: (v: boolean) => void;
}

const Ctx = createContext<ConnectionCtx | null>(null);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnectionState] = useState<Connection>(emptyConnection());
  const [verified, setVerified] = useState(false);

  const value = useMemo<ConnectionCtx>(
    () => ({
      connection,
      setConnection: (c: Connection) => {
        setConnectionState(c);
      },
      verified,
      setVerified,
    }),
    [connection, verified],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection(): ConnectionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConnection deve ser usado dentro de <ConnectionProvider>");
  return ctx;
}
