"use client";

import {
  Bot, Calendar, MessageCircle, Shield, Star, Stethoscope, UserCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Cómo piensa el agente, dibujado desde la configuración real de la clínica.
 *
 * Nace de un pedido concreto: la configuración es una lista de campos (tono,
 * servicios, doctores, horarios) y no se ve cómo se conectan, así que el dueño
 * de la clínica no tiene forma de saber qué hace su agente con lo que llenó.
 *
 * Se dibuja como grafo de nodos —cada paso es una caja con su tipo, sus puertos
 * y una arista hacia el siguiente— porque eso es lo que es. Una lista de viñetas
 * no comunica que hay un orden ni que un paso alimenta al otro.
 *
 * Los números salen de `config`, no están escritos a mano: si mañana agregan un
 * doctor, el diagrama lo dice. Uno estático miente a la primera semana.
 *
 * Es solo para ver. Editar el comportamiento se sigue haciendo en los campos.
 */

export interface AgentFlowConfig {
  assistantName?: string;
  tone?: string;
  doctors?: unknown[];
  services?: unknown[];
  schedule?: { weekdays?: string; saturday?: string; sunday?: string };
  whatsapp?: string | null;
  instagram?: string | null;
}

/** El tipo de nodo se muestra en la cabecera, como en cualquier editor de flujo. */
type TipoNodo = "entrada" | "filtro" | "contexto" | "respuesta" | "accion" | "humano" | "salida";

interface Nodo {
  tipo: TipoNodo;
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  /** Nodo alimentado por la configuración de la clínica. */
  propio?: boolean;
}

const TIPO_LABEL: Record<TipoNodo, string> = {
  entrada:   "entrada",
  filtro:    "filtro",
  contexto:  "contexto",
  respuesta: "respuesta",
  accion:    "acción",
  humano:    "decisión humana",
  salida:    "salida",
};

function construirNodos(cfg: AgentFlowConfig): Nodo[] {
  const nDoctores = Array.isArray(cfg.doctors) ? cfg.doctors.length : 0;
  const nServicios = Array.isArray(cfg.services) ? cfg.services.length : 0;
  const asistente = cfg.assistantName?.trim() || "Tu asistente";
  const horario = cfg.schedule?.weekdays?.trim();

  const canales = [
    cfg.whatsapp ? "WhatsApp" : null,
    "sitio web",
    cfg.instagram ? "Instagram" : null,
  ].filter(Boolean) as string[];

  return [
    {
      tipo: "entrada", icono: MessageCircle,
      titulo: "Llega un mensaje",
      detalle: canales.length > 1
        ? `${canales.slice(0, -1).join(", ")} y ${canales.at(-1)}`
        : canales[0],
    },
    {
      tipo: "filtro", icono: Shield,
      titulo: "Filtra lo que no corresponde",
      detalle: "Descarta lo que no es dental antes de gastar una consulta a la IA",
    },
    {
      tipo: "contexto", icono: Stethoscope,
      titulo: "Carga el contexto de tu clínica",
      detalle: [
        nDoctores ? `${nDoctores} ${nDoctores === 1 ? "profesional" : "profesionales"}` : "tu equipo",
        nServicios ? `${nServicios} ${nServicios === 1 ? "servicio" : "servicios"} con precio` : "tus servicios",
        horario || "tu horario",
      ].join(" · "),
      propio: true,
    },
    {
      tipo: "respuesta", icono: Bot,
      titulo: `${asistente} responde`,
      detalle: cfg.tone?.trim()
        ? `Con el tono que definiste: ${cfg.tone.trim()}`
        : "Con el tono que definas en la configuración",
      propio: true,
    },
    {
      tipo: "accion", icono: Calendar,
      titulo: "Si quiere hora, la reserva",
      detalle: "Toma el cupo para que nadie más lo agarre — todavía no es una cita",
    },
    {
      tipo: "humano", icono: UserCheck,
      titulo: "Tú confirmas, no el agente",
      detalle: "Te llega por WhatsApp con un link. Si no puedes, el paciente recibe otros horarios tuyos",
      propio: true,
    },
    {
      tipo: "salida", icono: Star,
      titulo: "Califica al paciente",
      detalle: "Puntaje por urgencia e intención, para saber a quién llamar primero",
    },
  ];
}

export function AgentFlowDiagram({ config, compact = false }: {
  config: AgentFlowConfig;
  compact?: boolean;
}) {
  const nodos = construirNodos(config);

  return (
    <div className="flujo-agente w-full">
      <ol className="flex flex-col">
        {nodos.map((nodo, i) => {
          const Icono = nodo.icono;
          const ultimo = i === nodos.length - 1;
          return (
            <li key={nodo.titulo} className="grid grid-cols-[2.4rem_1fr] sm:grid-cols-[3rem_1fr] gap-x-3 sm:gap-x-4">
              {/* Riel: marcador del nodo + arista hacia el siguiente */}
              <div className="flex flex-col items-center">
                <span
                  className="nodo-marca flex items-center justify-center rounded-xl border shrink-0"
                  style={{
                    width: 40, height: 40,
                    backgroundColor: nodo.propio ? "var(--teal-light, #E8F3F7)" : "var(--surface-white, #FDFCFB)",
                    borderColor: nodo.propio ? "rgba(26,92,122,0.3)" : "var(--border, #E5E0D9)",
                    color: nodo.propio ? "var(--teal-mid, #1A5C7A)" : "var(--ink-muted, #607281)",
                  }}
                >
                  <Icono className="w-[18px] h-[18px]" aria-hidden />
                </span>

                {!ultimo && (
                  <span className="arista relative w-px flex-1" aria-hidden
                    style={{ minHeight: compact ? 30 : 38, backgroundColor: "var(--border, #E5E0D9)" }}>
                    {/* Pulso: recorre la arista para que se lea la dirección del
                        flujo. Es la única animación y tiene ese trabajo. */}
                    <span className="pulso" />
                  </span>
                )}
              </div>

              {/* Caja del nodo */}
              <div className={compact ? "pb-3" : "pb-4"}>
                <div className="nodo rounded-xl border overflow-hidden"
                  style={{
                    borderColor: nodo.propio ? "rgba(26,92,122,0.22)" : "var(--border, #E5E0D9)",
                    backgroundColor: "var(--surface-white, #FDFCFB)",
                  }}>
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b"
                    style={{
                      borderColor: nodo.propio ? "rgba(26,92,122,0.14)" : "var(--border, #E5E0D9)",
                      backgroundColor: nodo.propio ? "rgba(26,92,122,0.045)" : "transparent",
                    }}>
                    <span className="font-mono text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: nodo.propio ? "var(--teal-mid, #1A5C7A)" : "var(--ink-faint, #8A9AA6)" }}>
                      {TIPO_LABEL[nodo.tipo]}
                    </span>
                    {nodo.propio && (
                      <span className="ml-auto text-[10px] font-semibold px-1.5 py-px rounded"
                        style={{ backgroundColor: "var(--teal-light, #E8F3F7)", color: "var(--teal-mid, #1A5C7A)" }}>
                        lo configuras tú
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-bold leading-tight" style={{ color: "var(--teal-dark, #0B2F42)" }}>
                      {nodo.titulo}
                    </p>
                    <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--ink-muted, #607281)" }}>
                      {nodo.detalle}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <style>{`
        .flujo-agente .pulso {
          position: absolute;
          left: -1.5px;
          width: 4px;
          height: 14px;
          border-radius: 2px;
          background: linear-gradient(to bottom, transparent, var(--teal-mid, #1A5C7A), transparent);
          animation: flujo-pulso 2.6s cubic-bezier(0.5, 0, 0.5, 1) infinite;
          opacity: 0;
        }
        /* Cada arista arranca un poco después que la anterior: se lee como un
           mensaje bajando por el flujo, no como seis luces parpadeando. */
        .flujo-agente li:nth-child(1) .pulso { animation-delay: 0s; }
        .flujo-agente li:nth-child(2) .pulso { animation-delay: 0.34s; }
        .flujo-agente li:nth-child(3) .pulso { animation-delay: 0.68s; }
        .flujo-agente li:nth-child(4) .pulso { animation-delay: 1.02s; }
        .flujo-agente li:nth-child(5) .pulso { animation-delay: 1.36s; }
        .flujo-agente li:nth-child(6) .pulso { animation-delay: 1.70s; }

        @keyframes flujo-pulso {
          0%   { top: -14px; opacity: 0; }
          12%  { opacity: 1; }
          38%  { opacity: 1; }
          50%  { top: 100%; opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }

        .flujo-agente .nodo { transition: border-color 160ms ease, box-shadow 160ms ease; }
        .flujo-agente li:hover .nodo {
          border-color: rgba(26,92,122,0.38);
          box-shadow: 0 1px 3px rgba(11,47,66,0.07);
        }
        .flujo-agente li:hover .nodo-marca { border-color: rgba(26,92,122,0.45); }

        @media (prefers-reduced-motion: reduce) {
          .flujo-agente .pulso { animation: none; opacity: 0; }
          .flujo-agente .nodo { transition: none; }
        }
      `}</style>
    </div>
  );
}
