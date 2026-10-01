import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "molari.ai — software de gestión dental con recepción IA",
  description: "Agenda, ficha clínica, odontograma, pagos y analytics para tu clínica dental — con una recepción IA que responde a tus pacientes 24/7 en WhatsApp y tu web.",
  // Instalada en el iPhone (pantalla de inicio) se abre sin barra de Safari.
  appleWebApp: { capable: true, title: "molari", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FDFCFB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
