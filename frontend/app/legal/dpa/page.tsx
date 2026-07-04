import Link from "next/link";

export const metadata = { title: "Contrato de Tratamiento de Datos (DPA) — molari.ai" };

// Mantener sincronizado con DPA_VERSION en backend/src/routes/clinics.ts
const DPA_VERSION = "2026-06-draft";
const LAST_UPDATED = "14 de junio de 2026";

export default function DpaPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
      <nav className="bg-white border-b px-6 py-4" style={{ borderColor: "#E5E0D9" }}>
        <Link href="/" className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--teal-dark, #0B2F42)" }}>
          ← molari.ai
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Estado: borrador hasta validación legal */}
        <div className="mb-8 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#E0B400", backgroundColor: "#FFF8E1", color: "#7A5C00" }}>
          <strong>BORRADOR — pendiente de validación legal.</strong> Este documento es una plantilla
          operativa y no constituye asesoría legal. Debe ser revisado por un abogado antes de su uso
          contractual definitivo.
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--coral, #D95F45)" }}>
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display,sans-serif)] text-3xl sm:text-4xl font-bold mb-2" style={{ color: "var(--ink, #0C1B26)" }}>
          Contrato de Tratamiento de Datos (DPA)
        </h1>
        <p className="text-sm mb-1" style={{ color: "var(--ink-muted, #607281)" }}>
          Entre molari.ai (Encargado de Tratamiento) y la Clínica (Responsable de Tratamiento).
        </p>
        <p className="text-sm mb-10" style={{ color: "var(--ink-muted, #607281)" }}>
          Versión: {DPA_VERSION} · Última actualización: {LAST_UPDATED}
        </p>

        <Section title="1. Objeto">
          Este Contrato regula el tratamiento de datos personales que molari.ai realiza por cuenta de
          la Clínica al prestarle el servicio de software dental, conforme a la Ley N° 21.719 sobre
          protección de datos personales de Chile.
        </Section>

        <Section title="2. Roles de las partes">
          La <strong>Clínica</strong> es el Responsable del Tratamiento: determina los fines y medios
          del tratamiento de los datos de sus pacientes. <strong>molari.ai</strong> es el Encargado del
          Tratamiento: trata los datos únicamente siguiendo las instrucciones documentadas de la Clínica.
        </Section>

        <Section title="3. Datos y finalidades">
          molari.ai trata datos de identificación y contacto de pacientes, datos de citas, ficha clínica
          y datos de facturación, con la única finalidad de prestar el servicio contratado (agenda,
          recordatorios, ficha clínica, pagos y facturación). molari.ai no usa estos datos para fines
          propios distintos de la prestación y mejora del servicio.
        </Section>

        <Section title="4. Obligaciones de molari.ai (Encargado)">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Tratar los datos solo según las instrucciones de la Clínica.</li>
            <li>Garantizar la confidencialidad de quienes traten los datos.</li>
            <li>Aplicar medidas de seguridad técnicas y organizativas adecuadas.</li>
            <li>Asistir a la Clínica en la atención de derechos de los titulares (acceso, rectificación, supresión, oposición).</li>
            <li>Notificar a la Clínica sin demora indebida ante una brecha de seguridad.</li>
            <li>Suprimir o devolver los datos al término del contrato, salvo obligación legal de conservación.</li>
          </ul>
        </Section>

        <Section title="5. Subencargados">
          molari.ai puede recurrir a subencargados (p. ej. proveedores de infraestructura, mensajería
          WhatsApp, pasarela de pagos y facturación electrónica) bajo obligaciones de protección de
          datos equivalentes a las de este Contrato. [VERIFICAR: listado de subencargados a anexar.]
        </Section>

        <Section title="6. Conservación">
          Los datos de ficha clínica se conservan por el plazo de retención que exige la normativa de
          salud aplicable. [VERIFICAR: plazo y norma — referencia a Ley 20.584 y reglamento de fichas
          clínicas.] Los datos de contacto y marketing se eliminan cuando dejan de ser necesarios o
          ante revocación del consentimiento.
        </Section>

        <Section title="7. Derechos de los titulares">
          molari.ai pone a disposición de la Clínica las herramientas para que los pacientes ejerzan sus
          derechos, incluyendo la descarga de sus datos y la solicitud de supresión, respetando los
          plazos de conservación legalmente exigidos.
        </Section>

        <Section title="8. Vigencia">
          Este Contrato rige mientras la Clínica use el servicio de molari.ai y se entiende aceptado al
          crear la cuenta. molari.ai podrá actualizar el texto notificando a la Clínica; el uso continuado
          del servicio implica aceptación de la versión vigente.
        </Section>

        <div className="mt-12 pt-8 border-t flex flex-wrap gap-4 text-sm" style={{ borderColor: "#E5E0D9", color: "var(--ink-muted, #607281)" }}>
          <Link href="/legal/privacidad" className="underline underline-offset-2 hover:opacity-70">Política de Privacidad</Link>
          <Link href="/legal/terminos" className="underline underline-offset-2 hover:opacity-70">Términos y Condiciones</Link>
          <Link href="/" className="underline underline-offset-2 hover:opacity-70">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-2" style={{ color: "var(--ink, #0C1B26)" }}>{title}</h2>
      <div className="text-sm leading-relaxed" style={{ color: "var(--ink-muted, #607281)" }}>{children}</div>
    </section>
  );
}
