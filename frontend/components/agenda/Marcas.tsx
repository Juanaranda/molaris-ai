import { Badge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { restanteHasta, type Peldano } from "@/lib/plazos";
import { esperaConfirmacion } from "@/lib/solicitudes";
import type { Booking } from "./tipos";

/**
 * Marcas de estado de la agenda (opción A, "escalera coral").
 *
 * El coral es lo único con color fuerte, y solo en marcas chicas: el punto y
 * el plazo. El área la pinta un tinte pálido del mismo coral, más intenso
 * mientras menos falta para que la solicitud venza.
 */
export const TINTE: Record<Peldano, string> = {
  1: "bg-accent-50",
  2: "bg-accent-soft",
  3: "bg-accent-200",
};

/** "Vence en 45 min" con el punto coral; "Plazo vencido" si ya pasó. */
export function Plazo({ deadline, ahora, className }: { deadline: string | null; ahora: Date; className?: string }) {
  const queda = restanteHasta(deadline, ahora);
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs font-bold text-accent-ink whitespace-nowrap", className)}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
      {!queda ? "Por confirmar" : queda.vencida ? "Plazo vencido" : `Vence ${queda.texto}`}
    </span>
  );
}

/**
 * Una sola marca por cita: lo que hay que saber de su estado. Una confirmada
 * no lleva marca (es lo normal), salvo la que está en el box ahora.
 */
export function MarcaEstado({ b, ahora, enCurso = false }: { b: Booking; ahora: Date; enCurso?: boolean }) {
  if (esperaConfirmacion(b)) return <Plazo deadline={b.confirmDeadline} ahora={ahora} />;
  if (b.status === "cancelled") return <Badge>Cancelada</Badge>;
  if (b.status === "pending") return <Badge>Pendiente</Badge>;
  if (enCurso) return <Badge tone="brand">Ahora</Badge>;
  return null;
}

const PAGO: Record<string, string> = { paid: "Pagada", partial: "Pago parcial", waived: "Bonificada" };

/** El pago va como texto en la línea de detalle: dato, no alarma. */
export function textoPago(paymentStatus: string | null): string | null {
  return paymentStatus ? PAGO[paymentStatus] ?? null : null;
}
