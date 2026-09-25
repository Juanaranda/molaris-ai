/**
 * Lo que una clínica devuelve al panel, sin sus credenciales (MOL-29).
 *
 * `GET /clinics/:id`, el `PATCH` y el interruptor del asistente devolvían la fila
 * entera, y con ella el token de WhatsApp, el de Mercado Pago y las keys del SII
 * y de ZapSign, a cualquier persona del equipo. Una recepcionista podía sacar el
 * token de Mercado Pago y operar la cuenta de la clínica.
 *
 * Ninguna pantalla necesita esos valores: para saber si una integración está
 * conectada existe `GET /clinics/:id/integrations`, que ya los omitía a propósito.
 *
 * Es una lista de exclusión y no de campos permitidos porque el panel usa la
 * respuesta del PATCH. El riesgo de ese enfoque es que se agregue una columna
 * secreta nueva y se filtre; `clinicaSinSecretos.test.ts` falla si aparece en el
 * modelo un campo con token/key/secret que no esté en esta lista.
 */
export const CAMPOS_SECRETOS = [
  "apiKey",
  "waToken",
  "mpAccessToken",
  "siiApiKey",
  "zapsignApiKey",
] as const;

export function clinicaSinSecretos<T extends object>(clinica: T): Omit<T, (typeof CAMPOS_SECRETOS)[number]> {
  const copia = { ...clinica } as Record<string, unknown>;
  for (const campo of CAMPOS_SECRETOS) delete copia[campo];
  return copia as Omit<T, (typeof CAMPOS_SECRETOS)[number]>;
}
