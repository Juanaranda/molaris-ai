/**
 * Contenido de la landing (rediseño oct 2026, dirección "el producto en vivo").
 *
 * Vive acá y no dentro de los componentes para poder revisarlo con tests: la
 * landing no puede prometer lo que molari no hace, y el ejemplo es una clínica
 * inventada, nunca la del piloto.
 *
 * Todo lo que se muestra es de Clínica Dental Aurora, con doctores y pacientes
 * inventados.
 */

export const CLINICA_EJEMPLO = "Clínica Dental Aurora";

/* ── El chat del hero ─────────────────────────────────────────────────────── */

export type Quien = "paciente" | "molari";
export type LineaChat = { quien: Quien; texto: string; hora: string };
export type Guion = { id: string; boton: string; lineas: LineaChat[] };

/** Lo que el paciente ve antes de conversar (es lo que molari manda de verdad). */
export const AVISO_IA = "Te responde un asistente con IA de la clínica. Comparte solo lo necesario para tu consulta.";

/**
 * Conversaciones de ejemplo. Muestran lo que el agente hace de verdad: ofrece
 * horas libres de la agenda y deja la hora PEDIDA. Nunca la da por agendada:
 * eso lo decide la clínica.
 */
export const GUIONES: Guion[] = [
  {
    id: "hora",
    boton: "¿Tienen hora esta semana?",
    lineas: [
      { quien: "paciente", texto: "Hola! tienen hora para una limpieza esta semana?", hora: "23:40" },
      { quien: "molari", texto: "¡Hola! Tengo el martes 21 a las 10:00 o el jueves 23 a las 16:30 con el Dr. Muñoz. ¿Cuál te acomoda?", hora: "23:40" },
      { quien: "paciente", texto: "el martes porfa", hora: "23:41" },
      { quien: "molari", texto: "Listo, te dejé pedida la hora del martes 21 a las 10:00. La clínica te la confirma en la mañana.", hora: "23:41" },
    ],
  },
  {
    id: "dolor",
    boton: "Me duele una muela",
    lineas: [
      { quien: "paciente", texto: "Hola, me duele mucho una muela desde ayer", hora: "07:12" },
      { quien: "molari", texto: "Lo siento mucho. Hoy tengo una hora a las 12:30 con el Dr. Herrera. ¿Te la dejo pedida?", hora: "07:12" },
      { quien: "paciente", texto: "sí por favor", hora: "07:13" },
      { quien: "molari", texto: "Hecho. La clínica te la confirma apenas abra.", hora: "07:13" },
    ],
  },
  {
    id: "orto",
    boton: "Quiero frenillos",
    lineas: [
      { quien: "paciente", texto: "hola quiero ponerme frenillos, cómo es?", hora: "21:05" },
      { quien: "molari", texto: "¡Hola! Parte con una evaluación con el Dr. Vidal, que es ortodoncista. Atiende lunes, miércoles y viernes. ¿Qué día te acomoda?", hora: "21:05" },
      { quien: "paciente", texto: "el viernes en la tarde", hora: "21:06" },
      { quien: "molari", texto: "Tengo el viernes 24 a las 17:00. ¿Te la dejo pedida?", hora: "21:06" },
    ],
  },
];

/* ── El recorrido: un paciente de principio a fin ────────────────────────── */

export type Paso = { id: "conversa" | "agenda" | "ficha" | "pago"; titulo: string; texto: string };

export const RECORRIDO: Paso[] = [
  { id: "conversa", titulo: "Primero, molari conversa.", texto: "Responde por WhatsApp a cualquier hora, ofrece las horas libres de tu agenda y deja la solicitud lista para ti." },
  { id: "agenda", titulo: "Tú confirmas, y queda en la agenda.", texto: "Con un toque pasa a la agenda del doctor. molari le recuerda la cita al paciente el día anterior y dos horas antes." },
  { id: "ficha", titulo: "En el box, la ficha está lista.", texto: "Anamnesis, notas de cada atención y odontograma. Cada registro queda con quién lo hizo y cuándo." },
  { id: "pago", titulo: "Y al final, el pago queda anotado.", texto: "Registras lo que pagó y la cuenta del paciente queda al día, junto a su presupuesto." },
];

/* ── Todo lo que trae, por momento de la atención ────────────────────────── */

export type Funcion = { nombre: string; detalle: string };
export type Momento = { momento: string; funciones: Funcion[] };

/** Solo lo que existe hoy en el producto. */
export const MOMENTOS: Momento[] = [
  {
    momento: "Antes de la cita",
    funciones: [
      { nombre: "Recepción con IA", detalle: "Contesta por WhatsApp y en tu web, ofrece las horas libres y deja la solicitud para que la confirmes." },
      { nombre: "Agenda por doctor y box", detalle: "Cada profesional con su columna. Lo que confirmas desde el chat aparece ahí al instante." },
      { nombre: "Recordatorios y lista de espera", detalle: "Recordatorio el día anterior y dos horas antes. Si alguien cancela, la lista de espera se entera." },
      { nombre: "Controles al día", detalle: "molari le recuerda a cada paciente su próximo control, según las reglas que definas." },
    ],
  },
  {
    momento: "En el box",
    funciones: [
      { nombre: "Ficha clínica", detalle: "Anamnesis, notas de cada atención y consentimientos firmados, con autor y fecha." },
      { nombre: "Odontograma", detalle: "Numeración FDI, el historial de cada pieza y sus fotos y radiografías." },
      { nombre: "Presupuestos y tratamientos", detalle: "Arma el presupuesto desde el odontograma y sigue el avance de cada tratamiento." },
    ],
  },
  {
    momento: "Después",
    funciones: [
      { nombre: "Pagos y cuenta del paciente", detalle: "Abonos y saldo pendiente y, si los conectas, pagos en línea y boleta electrónica." },
      { nombre: "Panel de gestión", detalle: "Ingresos del mes, citas y de dónde llegan tus pacientes." },
    ],
  },
];

/* ── Planes ──────────────────────────────────────────────────────────────── */

export type Plan = { id: string; nombre: string; precio: string; periodo: string; para: string; accion: { texto: string; href: string }; destacado?: boolean };

export const PLANES: Plan[] = [
  { id: "doctor", nombre: "Doctor", precio: "$12.990", periodo: "al mes", para: "Para el dentista independiente", accion: { texto: "Empezar", href: "/register" } },
  { id: "esencial", nombre: "Esencial", precio: "$59.990", periodo: "al mes", para: "Para la clínica que se digitaliza", accion: { texto: "Empezar", href: "/register" } },
  { id: "profesional", nombre: "Profesional", precio: "$99.990", periodo: "al mes", para: "La clínica completa", accion: { texto: "Empezar", href: "/register" }, destacado: true },
  { id: "clinica", nombre: "Clínica+", precio: "A medida", periodo: "", para: "Para grupos y varias sedes", accion: { texto: "Conversemos", href: "https://wa.me/56966865887" } },
];

/** Qué trae cada plan, en palabras (sin tics). Mismo orden que PLANES. */
export const COMPARACION: { que: string; valores: [string, string, string, string] }[] = [
  { que: "Profesionales", valores: ["1", "Hasta 2", "Hasta 5", "Sin límite"] },
  { que: "Recepción con IA", valores: ["WhatsApp y web", "Web", "WhatsApp y web", "WhatsApp y web"] },
  { que: "Agenda y recordatorios", valores: ["Incluida", "Incluida", "Incluida", "Incluida"] },
  { que: "Ficha clínica y odontograma", valores: ["Incluida", "Incluida", "Incluida", "Incluida"] },
  { que: "Controles y lista de espera", valores: ["No incluido", "No incluido", "Incluido", "Incluido"] },
  { que: "Pagos en línea y boleta", valores: ["Registro de pagos", "No incluido", "Incluido", "Incluido"] },
  { que: "Panel de gestión", valores: ["No incluido", "No incluido", "Incluido", "Incluido"] },
  { que: "Soporte prioritario", valores: ["No incluido", "No incluido", "Incluido", "Incluido"] },
  { que: "Onboarding dedicado", valores: ["No incluido", "No incluido", "No incluido", "Incluido"] },
];

/* ── Preguntas frecuentes ────────────────────────────────────────────────── */

export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  { pregunta: "¿La IA agenda sola?", respuesta: "No. Ofrece horas libres de tu agenda y deja la hora pedida. Tú la confirmas o propones otra, y recién ahí entra a la agenda." },
  { pregunta: "¿El paciente sabe que le responde una IA?", respuesta: "Sí. Antes de conversar, molari le avisa que es un asistente con IA y le pide compartir solo lo necesario." },
  { pregunta: "¿Puedo traer mis pacientes?", respuesta: "Sí. Puedes importar tu lista de pacientes desde un archivo CSV." },
  { pregunta: "¿Los datos son míos?", respuesta: "Sí. Descargas tu lista de pacientes cuando quieras, sin pedirle permiso a nadie." },
  { pregunta: "¿Sirve si atiendo solo?", respuesta: "Sí. El plan Doctor es para el dentista independiente: un profesional, con recepción con IA, agenda, ficha y pagos." },
  { pregunta: "¿Qué pasa con las fichas clínicas?", respuesta: "Cada registro queda con el profesional que lo hizo y la fecha, y no se borra. Lo diseñamos pensando en la Ley 20.584." },
  { pregunta: "¿Tengo que firmar un contrato largo?", respuesta: "No. Pagas mes a mes y cancelas cuando quieras." },
];
