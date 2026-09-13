import "./globals.css";
import type { Metadata } from "next";
import { Roboto, Open_Sans } from "next/font/google";

// Fontes do padrão visual.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
});
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-opensans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MapCidade · Metadata Publisher",
  description:
    "Publicar, copiar e transferir metadados de temas no console MapCidade",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${openSans.variable}`}>
      <body className="grid-overlay font-body text-gp-lightgray antialiased">
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
        <footer className="relative z-10 border-t border-gp-bar5/10">
          <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-2 px-6 py-5 font-body text-[11px] tracking-wide text-gp-darkgray sm:flex-row sm:justify-between md:px-10">
            <span>
              <span className="text-[#9db4cf]">map</span>
              <span className="text-[#489CD5]">cidade</span>
              {" — portfolio anonimizado, dados fictícios."}
            </span>
            <span>
              Ferramenta interna ·{" "}
              <span className="font-semibold text-gp-teal">Suporte / Implantação</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
