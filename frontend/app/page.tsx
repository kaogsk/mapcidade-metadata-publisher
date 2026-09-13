"use client";

import { useState } from "react";
import { Brand } from "@/components/Brand";
import { ConnectionProvider, useConnection } from "@/components/ConnectionContext";
import { ConnectionTab } from "@/components/tabs/ConnectionTab";
import { CreateThemesTab } from "@/components/tabs/CreateThemesTab";
import { CopyThemesTab } from "@/components/tabs/CopyThemesTab";
import { TransferTab } from "@/components/tabs/TransferTab";
import { CertificateTab } from "@/components/tabs/CertificateTab";

type TabKey = "connection" | "create" | "copy" | "transfer" | "certificate";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "connection", label: "Conexão", icon: "🔌" },
  { key: "create", label: "Criar temas", icon: "➕" },
  { key: "copy", label: "Copiar temas", icon: "📋" },
  { key: "transfer", label: "Transferir", icon: "🔀" },
  { key: "certificate", label: "Certidão JSON", icon: "📄" },
];

function ConnectionBadge() {
  const { connection, verified } = useConnection();
  const label = connection.database
    ? `${connection.database}${connection.ssh ? " · ssh" : ""}`
    : "sem conexão";
  return (
    <span
      className={`gp-chip ${
        verified ? "border-gp-bar7/50 text-gp-bar7" : "border-gp-bar5/25 text-gp-darkgray"
      }`}
      title={verified ? "Conexão verificada" : "Conexão não verificada"}
    >
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${
          verified ? "bg-gp-bar7" : "bg-gp-darkgray/50"
        }`}
      />
      {label}
    </span>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabKey>("connection");

  return (
    <>
      <Brand right={<ConnectionBadge />} />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 md:px-8">
        {/* Navegação por abas */}
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Operações">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-display text-[13.5px] font-bold tracking-tight outline-none transition focus-visible:ring-2 focus-visible:ring-gp-bar4/60 ${
                  active
                    ? "border-gp-bar4/60 bg-gp-teal/20 text-white shadow-glow"
                    : "border-gp-bar5/20 bg-gp-navy/30 text-gp-darkgray hover:border-gp-bar4/40 hover:text-gp-lightgray"
                }`}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Conteúdo — todas as abas ficam montadas para preservar estado; só a ativa é exibida. */}
        <div className={tab === "connection" ? "" : "hidden"}>
          <ConnectionTab />
        </div>
        <div className={tab === "create" ? "" : "hidden"}>
          <CreateThemesTab />
        </div>
        <div className={tab === "copy" ? "" : "hidden"}>
          <CopyThemesTab />
        </div>
        <div className={tab === "transfer" ? "" : "hidden"}>
          <TransferTab />
        </div>
        <div className={tab === "certificate" ? "" : "hidden"}>
          <CertificateTab />
        </div>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <ConnectionProvider>
      <Shell />
    </ConnectionProvider>
  );
}
