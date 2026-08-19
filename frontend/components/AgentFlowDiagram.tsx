"use client";

import {
  Bot, Calendar, CircleCheck, MessageCircle, Shield, Star, Stethoscope,
  type LucideIcon,
} from "lucide-react";

/**
 * Cómo piensa el agente, dibujado desde la configuración real de la clínica.
 *
 * Nace de un pedido concreto: la configuración es hoy una lista de campos
 * (tono, servicios, doctores, horarios) y no se ve cómo se conectan, así que
 * el dueño de la clínica no tiene forma de saber qué hace su agente con lo que
 * llenó.
 *
 * Los números salen de `config`, no están escritos a mano: si mañana agregan
 * un doctor, el diagrama lo dice. Un diagrama estático miente a la primera
 * semana, y uno que miente es peor que no tenerlo.
 *
 * Es solo para ver. Editar el comportamiento se sigue haciendo en los campos
 * de siempre.
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

interface Paso {
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  /** Los pasos "propios" son los que la clínica controla desde su configuración. */
  destacado?: boolean;
}

function construirPasos(cfg: AgentFlowConfig): Paso[] {
  const nDoctores = Array.isArray(cfg.doctors) ? cfg.doctors.length : 0;
  const nServicios = Array.isArray(cfg.services) ? cfg.services.length : 0;
  const asistente = cfg.assistantName?.trim() || "Tu asistente";

  const canales = [
    cfg.whatsapp ? "WhatsApp" : null,
    "tu sitio web",
    cfg.instagram ? "Instagram" : null,
  ].filter(Boolean) as string[];

  const horario = cfg.schedule?.weekdays?.trim();

  return [
    {
      icono: MessageCircle,
      titulo: "Llega un mensaje",
      detalle: canales.length > 1
        ? `Desde ${canales.slice(0, -1).join(", ")} y ${canales.at(-1)}`
        : `Desde ${canales[0]}`,
    },
    {
      icono: Shield,
      titulo: "Filtra lo que no corresponde",
      detalle: "Descarta mensajes fuera del ámbito dental antes de gastar una consulta a la IA",
    },
    {
      icono: Stethoscope,
      titulo: "Carga el contexto de tu clínica",
      detalle: [
        nDoctores ? `${nDoctores} ${nDoctores === 1 ? "profesional" : "profesionales"}` : "Tu equipo",
        nServicios ? `${nServicios} ${nServicios === 1 ? "servicio" : "servicios"} con sus precios` : "Tus servicios",
        horario || "Tu horario de atención",
      ].join(" · "),
      destacado: true,
    },
    {
      icono: Bot,
      titulo: `${asistente} responde`,
      detalle: cfg.tone?.trim()
        ? `Con el tono que definiste: ${cfg.tone.trim()}`
        : "Con el tono que definas en la configuración",
      destacado: true,
    },
    {
      icono: Calendar,
      titulo: "Si el paciente quiere hora, la agenda",
      detalle: "Revisa el cupo del profesional antes de confirmar, para no pisar una cita existente",
    },
    {
      icono: Star,
      titulo: "Califica al paciente",
      detalle: "Le pone un puntaje según urgencia e intención, para que sepas a quién llamar primero",
    },
  ];
}

export function AgentFlowDiagram({ config, compact = false }: {
  config: AgentFlowConfig;
  /** En la landing se muestra más apretado y sin la nota del pie. */
  compact?: boolean;
}) {
  const pasos = construirPasos(config);

  return (
    <div className="w-full">
      <ol className="relative flex flex-col gap-0">
        {pasos.map((paso, i) => {
          const Icono = paso.icono;
          const ultimo = i === pasos.length - 1;
          return (
            <li key={paso.titulo} className="relative flex gap-3 sm:gap-4">
              {/* Columna del icono + línea que conecta con el siguiente paso */}
              <div className="flex flex-col items-center shrink-0">
                <span
                  className="flex items-center justify-center rounded-xl border shrink-0"
                  style={{
                    width: 38, height: 38,
                    backgroundColor: paso.destacado ? "#E8F3F7" : "#FDFCFB",
                    borderColor: paso.destacado ? "rgba(26,92,122,0.25)" : "#E5E0D9",
                    color: paso.destacado ? "#1A5C7A" : "#607281",
                  }}
                >
                  <Icono className="w-[18px] h-[18px]" aria-hidden />
                </span>
                {!ultimo && (
                  <span
                    aria-hidden
                    className="w-px flex-1"
                    style={{ backgroundColor: "#E5E0D9", minHeight: compact ? 18 : 26 }}
                  />
                )}
              </div>

              <div className={compact ? "pb-4" : "pb-6"}>
                <p className="text-sm font-bold leading-tight" style={{ color: "#0B2F42" }}>
                  {paso.titulo}
                </p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: "#607281" }}>
                  {paso.detalle}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {!compact && (
        <p className="text-[11px] mt-1 flex items-start gap-1.5" style={{ color: "#8A9AA6" }}>
          <CircleCheck className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden />
          <span>
            Los pasos resaltados usan lo que configuraste más abajo. Si cambias tu equipo,
            tus servicios o tu horario, el agente cambia con ellos.
          </span>
        </p>
      )}
    </div>
  );
}
