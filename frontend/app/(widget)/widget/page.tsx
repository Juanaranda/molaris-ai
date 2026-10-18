import { Suspense } from "react";
import { WidgetChat } from "./WidgetChat";

export default function WidgetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "#888" }}>Cargando...</div>}>
      <WidgetChat />
    </Suspense>
  );
}
