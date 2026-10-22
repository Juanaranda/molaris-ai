import type { Metadata } from "next";
import "../globals.css";

// Root layout propio del widget: vive en un iframe dentro del sitio de la
// clínica, así que no lleva la fuente ni las clases del body del sitio. Los
// estilos globales sí, porque el aviso de privacidad y el selector de horas
// usan clases de Tailwind.
export const metadata: Metadata = {
  title: "Asistente virtual",
};

export default function WidgetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="antialiased">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif", background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
