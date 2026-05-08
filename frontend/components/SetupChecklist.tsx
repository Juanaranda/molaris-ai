"use client";

interface ClinicConfig {
  tone?: string;
  assistantName?: string;
  doctors?: unknown[];
  services?: unknown[];
  schedule?: Record<string, string>;
}

interface ClinicData {
  slug: string;
  whatsapp?: string | null;
  config: unknown;
}

interface CheckItem {
  label: string;
  done: boolean;
  hint?: string;
}

interface Props {
  clinic: ClinicData;
  onGoToConfig: () => void;
}

export function SetupChecklist({ clinic, onGoToConfig }: Props) {
  const cfg = (clinic.config as ClinicConfig) ?? {};

  const items: CheckItem[] = [
    { label: "Nombre del asistente configurado",   done: !!cfg.assistantName, hint: "Pestaña Configuración → Nombre del asistente" },
    { label: "Al menos un doctor cargado",          done: (cfg.doctors?.length ?? 0) > 0, hint: "Configuración → Doctores" },
    { label: "Servicios definidos",                 done: (cfg.services?.length ?? 0) > 0, hint: "Configuración → Servicios" },
    { label: "Horarios configurados",               done: !!cfg.schedule?.weekdays, hint: "Configuración → Horarios de atención" },
    { label: "WhatsApp registrado",                 done: !!clinic.whatsapp, hint: "Configuración → WhatsApp" },
    { label: "Webhook de WhatsApp configurado en Twilio", done: false, hint: "Copia la URL del webhook y pégala en tu consola Twilio" },
  ];

  const completed = items.filter((i) => i.done).length;
  const allDone   = completed === items.length;

  if (allDone) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-blue-900 text-sm">Completa la configuración</p>
          <p className="text-xs text-blue-500 mt-0.5">{completed} de {items.length} pasos listos</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-blue-600">{Math.round((completed / items.length) * 100)}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-blue-100 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.done ? "bg-blue-500" : "bg-white border-2 border-blue-200"}`}>
              {item.done && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-2.5 h-2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${item.done ? "text-blue-400 line-through" : "text-blue-900"}`}>
                {item.label}
              </p>
              {!item.done && item.hint && (
                <p className="text-[11px] text-blue-400 mt-0.5">{item.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onGoToConfig}
        className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        Ir a Configuración
      </button>
    </div>
  );
}
