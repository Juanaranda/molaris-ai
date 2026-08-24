/**
 * Qué falta para poder avanzar en el onboarding.
 *
 * El asistente de configuración dejaba seguir sin llenar nada y terminaba
 * creando una clínica que el agente no podía usar: sin nombre no sabe cómo
 * presentarse, sin profesionales no puede agendar con nadie, y con todos los
 * días cerrados responde que nunca hay horas.
 *
 * Vive fuera del componente para poder probar las reglas sin montar la pantalla
 * — son lógica de negocio, no maquetado.
 *
 * Los mensajes dicen para qué sirve el dato y no solo que es obligatorio: quien
 * llena esto no tiene por qué adivinar por qué se lo piden.
 */

export interface DoctorOnboarding {
  name: string;
  days: string[];
}

export interface DiaHorario {
  open: boolean;
  from: string;
  to: string;
}

export interface DatosOnboarding {
  esSolo: boolean;
  nombreClinica: string;
  telefono: string;
  ubicacion: string;
  doctores: DoctorOnboarding[];
  /** Los días tal como los tenga la pantalla; solo importan sus valores. */
  horario: DiaHorario[];
}

/** Devuelve el mensaje del primer problema del paso, o null si está listo. */
export function queFaltaEn(paso: number, d: DatosOnboarding): string | null {
  if (paso === 2) {
    // En modo doctor independiente el nombre de la consulta es opcional: si lo
    // deja vacío se usa el suyo. El resto se pide igual.
    if (!d.esSolo && !d.nombreClinica.trim()) {
      return "Ponle nombre a la clínica: el asistente lo usa para presentarse a tus pacientes.";
    }
    if (!d.telefono.trim()) {
      return "Falta el teléfono. Es el número al que el asistente deriva cuando no puede resolver algo.";
    }
    if (!d.ubicacion.trim()) {
      return "Falta la ciudad o comuna. Los pacientes preguntan dónde quedan antes de agendar.";
    }
    return null;
  }

  if (paso === 3) {
    const conNombre = d.doctores.filter((x) => x.name.trim());
    if (conNombre.length === 0) {
      return "Agrega al menos un profesional: sin nadie en el equipo, el asistente no tiene con quién agendar.";
    }
    if (conNombre.some((x) => x.days.length === 0)) {
      return "Hay un profesional sin días de atención. Marca al menos uno o el asistente no le va a ofrecer horas.";
    }
    return null;
  }

  if (paso === 4) {
    const abiertos = d.horario.filter((x) => x.open);
    if (abiertos.length === 0) {
      return "Marca al menos un día de atención. Con todos cerrados, el asistente responde que no hay horas disponibles.";
    }
    if (abiertos.some((x) => x.from >= x.to)) {
      return "Hay un día que cierra antes de abrir. Revisa los horarios.";
    }
    return null;
  }

  return null;
}
