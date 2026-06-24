/**
 * Consentimientos informados — Issue #36.
 *
 * Ley 20.584: ningún procedimiento invasivo (extracción, endodoncia, cirugía,
 * implante) sin explicación previa de riesgos/beneficios + autorización escrita.
 *
 * 3 métodos de firma soportados:
 *  - "zapsign": link online (integración con API ZapSign, requiere apiKey por clínica)
 *  - "manual_upload": admin sube PDF firmado físicamente (escaneado)
 *  - "in_person_pad": firma presencial en clínica (solo registra el evento)
 */

import prisma from "../../config/prisma";

/** Templates default que se siembran al primer acceso de la clínica */
export const DEFAULT_TEMPLATES = [
  {
    procedureCode: "extraccion",
    title: "Consentimiento informado — Extracción dental",
    body: `# Consentimiento informado para extracción dental

Yo, **{paciente}**, RUT {rut}, autorizo al equipo profesional de **{clinica}** a realizar la extracción dental indicada.

## Procedimiento
Extracción de la(s) pieza(s) dental(es) indicada(s) bajo anestesia local. Incluye uso de instrumental rotatorio o quirúrgico según se requiera.

## Riesgos y complicaciones posibles
- Dolor e inflamación post-operatoria
- Sangrado prolongado
- Infección local o regional
- Lesión de estructuras adyacentes (dientes, encías, nervios)
- Alveolitis seca (5-10% de casos)
- Reacción adversa a la anestesia (rara)

## Cuidados post-operatorios
Recibiré indicaciones por escrito que me comprometo a seguir.

## Declaración
Declaro haber recibido información clara sobre el procedimiento, riesgos y alternativas, y haber podido formular las preguntas que estimé necesarias.

**Firma del paciente:** _____________________

**Fecha:** {fecha}`,
  },
  {
    procedureCode: "endodoncia",
    title: "Consentimiento informado — Endodoncia",
    body: `# Consentimiento informado para tratamiento endodóntico

Yo, **{paciente}**, RUT {rut}, autorizo al equipo profesional de **{clinica}** a realizar el tratamiento de endodoncia (tratamiento de conducto).

## Procedimiento
Eliminación del tejido pulpar infectado o necrótico, limpieza y obturación del sistema de conductos radiculares.

## Riesgos y complicaciones posibles
- Dolor e inflamación post-tratamiento
- Necesidad de visitas adicionales
- Posibilidad de fractura instrumental dentro del conducto
- Reacción periapical
- Fractura coronal o radicular (la pieza queda frágil — se recomienda corona)
- Fracaso del tratamiento (~5-10%), pudiendo requerir retratamiento o cirugía apical

## Compromiso del paciente
Me comprometo a la rehabilitación protésica posterior (corona) según se indique.

## Declaración
Declaro haber comprendido el procedimiento, las alternativas (incluida la extracción) y los riesgos.

**Firma del paciente:** _____________________

**Fecha:** {fecha}`,
  },
  {
    procedureCode: "implante",
    title: "Consentimiento informado — Implante dental",
    body: `# Consentimiento informado para implante dental

Yo, **{paciente}**, RUT {rut}, autorizo al equipo profesional de **{clinica}** a realizar la cirugía de implante dental.

## Procedimiento
Colocación quirúrgica de uno o más implantes de titanio en el hueso maxilar/mandibular, seguido de período de osteointegración (2-6 meses) antes de la rehabilitación protésica.

## Riesgos y complicaciones posibles
- Dolor, inflamación, hematomas post-quirúrgicos
- Sangrado
- Infección local
- Lesión nerviosa (parestesia transitoria o permanente)
- Perforación del seno maxilar (implantes superiores)
- Fracaso de osteointegración (~3-5%)
- Necesidad de injertos óseos adicionales

## Cuidados
Me comprometo a seguir las indicaciones de higiene y a asistir a los controles programados.

## Declaración
He sido informado de los riesgos, beneficios, alternativas (prótesis removible, puente fijo) y costos asociados.

**Firma del paciente:** _____________________

**Fecha:** {fecha}`,
  },
  {
    procedureCode: "ortodoncia",
    title: "Consentimiento informado — Tratamiento ortodóncico",
    body: `# Consentimiento informado para tratamiento de ortodoncia

Yo, **{paciente}**, RUT {rut}, autorizo el inicio de tratamiento ortodóncico en **{clinica}**.

## Procedimiento
Tratamiento con aparatología fija o removible (brackets, alineadores, retenedores) durante el período estimado por el profesional.

## Consideraciones
- Duración estimada: 12-36 meses según caso clínico
- Requiere controles periódicos mensuales/bimensuales
- Posibilidad de molestias y úlceras transitorias al inicio
- Riesgo de descalcificación si la higiene es deficiente
- Posible reabsorción radicular leve
- Retenedores de uso permanente al finalizar

## Compromiso
Me comprometo a:
- Asistir a los controles
- Mantener higiene oral rigurosa
- Cuidar la aparatología y reportar daños oportunamente
- Usar elásticos y aditamentos según indicación

## Declaración
He sido informado del plan de tratamiento, su duración estimada, riesgos y compromiso financiero.

**Firma del paciente:** _____________________

**Fecha:** {fecha}`,
  },
] as const;

/**
 * Crea los templates default si la clínica no tiene ninguno.
 */
export async function ensureDefaultConsentTemplates(clinicId: string): Promise<void> {
  const existing = await prisma.consentTemplate.count({ where: { clinicId } });
  if (existing > 0) return;
  for (const tpl of DEFAULT_TEMPLATES) {
    await prisma.consentTemplate.create({
      data: {
        clinicId,
        version:       1,
        title:         tpl.title,
        body:          tpl.body,
        procedureCode: tpl.procedureCode,
        active:        true,
      },
    });
  }
  console.info(`[Consents] Sembrados ${DEFAULT_TEMPLATES.length} templates default para clínica ${clinicId}`);
}

/**
 * Renderiza un template reemplazando placeholders {paciente}, {rut}, {clinica}, {fecha}.
 */
export function renderTemplate(
  body: string,
  vars: { paciente: string; rut: string; clinica: string; fecha?: string },
): string {
  const fecha = vars.fecha ?? new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  return body
    .replace(/\{paciente\}/g, vars.paciente)
    .replace(/\{rut\}/g, vars.rut || "______________")
    .replace(/\{clinica\}/g, vars.clinica)
    .replace(/\{fecha\}/g, fecha);
}

/* ─── ZapSign integration (skeleton, listo para enchufar) ────────────────── */

const ZAPSIGN_BASE = process.env.ZAPSIGN_BASE_URL ?? "https://api.zapsign.com.br/api/v1";

export interface ZapSignCreateDocInput {
  apiKey:       string;
  name:         string;
  text:         string;
  signerName:   string;
  signerEmail?: string;
  signerPhone?: string;
}

export interface ZapSignCreateDocResult {
  externalRef: string;
  signUrl:     string;
  status:      "pending" | "error";
  errorMessage?: string;
}

/**
 * Crea un documento de firma en ZapSign.
 * Por ahora se invoca solo si la clínica tiene zapsignApiKey + zapsignVerified.
 */
export async function createZapSignDoc(input: ZapSignCreateDocInput): Promise<ZapSignCreateDocResult> {
  try {
    const res = await fetch(`${ZAPSIGN_BASE}/docs/`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        name: input.name.slice(0, 200),
        signers: [{
          name:  input.signerName,
          email: input.signerEmail,
          phone_number: input.signerPhone,
        }],
        // ZapSign acepta texto plano o PDF. Para v1, mandamos text que ellos convierten.
        // Si el endpoint cambia, ajustar el body acá.
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { externalRef: "", signUrl: "", status: "error", errorMessage: `ZapSign ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = await res.json() as { token?: string; signers?: { sign_url?: string }[] };
    const signUrl = data.signers?.[0]?.sign_url ?? "";
    return {
      externalRef: data.token ?? "",
      signUrl,
      status: "pending",
    };
  } catch (err) {
    return { externalRef: "", signUrl: "", status: "error", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
