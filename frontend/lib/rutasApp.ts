/**
 * Rutas que cambian entre la web y la app de teléfono (MOL-40).
 *
 * La app lleva el panel como archivos estáticos dentro (Capacitor). Una ruta
 * con segmento variable, como /partners/pacientes/<id>, no tiene archivo para
 * cada id posible: el export genera una sola página marcador ("_") y la app
 * le pasa el id por query. En la web todo queda como siempre.
 */

export const ES_APP = process.env.NEXT_PUBLIC_APP_MOVIL === "1";

/** Valor del segmento en la única página que genera el export de la app. */
export const MARCADOR = "_";

/** Adónde llevar para ver la ficha de un paciente. */
export function rutaPaciente(id: string, app = ES_APP): string {
  return app
    ? `/partners/pacientes/${MARCADOR}/?id=${encodeURIComponent(id)}`
    : `/partners/pacientes/${encodeURIComponent(id)}`;
}

/** El id del paciente, venga en el segmento (web) o en la query (app). */
export function idDePaciente(segmento: string | undefined, query: string): string | null {
  if (segmento && segmento !== MARCADOR) return decodeURIComponent(segmento);
  return new URLSearchParams(query).get("id") || null;
}

/**
 * generateStaticParams de las rutas con segmento variable: en la app, solo la
 * página marcador; en la web, ninguna por adelantado (se arman al pedirlas).
 */
export function paramsEstaticos<K extends string>(clave: K, app = ES_APP): Record<K, string>[] {
  return app ? [{ [clave]: MARCADOR } as Record<K, string>] : [];
}
