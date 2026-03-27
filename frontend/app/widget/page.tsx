import { Suspense } from "react";
import { WidgetChat } from "./WidgetChat";

export default function WidgetPage() {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif", background: "#fff" }}>
        <Suspense fallback={<div style={{ padding: 16, color: "#888" }}>Cargando...</div>}>
          <WidgetChat />
        </Suspense>
      </body>
    </html>
  );
}
