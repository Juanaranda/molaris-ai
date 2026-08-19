import Link from "next/link";

export const metadata = { title: "Términos y Condiciones — molari.ai" };

const LAST_UPDATED = "11 de mayo de 2026";

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
      <nav className="bg-white border-b px-6 py-4" style={{ borderColor: "#E5E0D9" }}>
        <Link href="/" className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--teal-dark, #0B2F42)" }}>
          molari.ai
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--coral, #D95F45)" }}>
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display,sans-serif)] text-3xl sm:text-4xl font-bold mb-2" style={{ color: "var(--ink, #0C1B26)" }}>
          Términos y Condiciones
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--ink-muted, #607281)" }}>
          Última actualización: {LAST_UPDATED}
        </p>

        <LegalContent />

        <div className="mt-12 pt-8 border-t flex flex-wrap gap-4 text-sm" style={{ borderColor: "#E5E0D9", color: "var(--ink-muted, #607281)" }}>
          <Link href="/legal/privacidad" className="underline underline-offset-2 hover:opacity-70">Política de Privacidad</Link>
          <Link href="/" className="underline underline-offset-2 hover:opacity-70">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-3" style={{ color: "var(--ink, #0C1B26)" }}>{title}</h2>
      <div className="text-sm leading-relaxed flex flex-col gap-3" style={{ color: "var(--ink-muted, #607281)" }}>
        {children}
      </div>
    </section>
  );
}

function LegalContent() {
  return (
    <div>
      <Section title="1. Descripción del servicio">
        <p>
          molari.ai es una plataforma de asistente virtual con inteligencia artificial diseñada para clínicas dentales. Permite automatizar la atención inicial de pacientes a través de canales digitales (web y WhatsApp), facilitar el agendamiento de citas y gestionar leads de manera eficiente.
        </p>
        <p>
          El servicio es provisto por molari.ai, con domicilio en Santiago, Chile, a clínicas dentales que se registran como clientes (&quot;la Clínica&quot;).
        </p>
      </Section>

      <Section title="2. Aceptación de los términos">
        <p>
          Al registrarse en la plataforma, la Clínica acepta íntegramente estos Términos y Condiciones. Si no está de acuerdo con alguna de las condiciones aquí establecidas, no debe utilizar el servicio.
        </p>
        <p>
          La aceptación queda registrada electrónicamente con la fecha, hora y cuenta de correo del administrador que completó el registro, en conformidad con la Ley N° 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación.
        </p>
      </Section>

      <Section title="3. Uso del servicio y responsabilidades">
        <p>
          El asistente virtual de molari.ai es una herramienta de apoyo a la gestión de pacientes. Sus respuestas son informativas y no constituyen diagnóstico médico, confirmación definitiva de citas ni asesoría clínica de ningún tipo.
        </p>
        <p>
          La Clínica es responsable de:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Verificar y confirmar toda información antes de ejecutar acciones clínicas o administrativas.</li>
          <li>Configurar correctamente la información de doctores, servicios y horarios en la plataforma.</li>
          <li>Obtener el consentimiento de sus pacientes para el tratamiento de sus datos personales.</li>
          <li>Cumplir con la normativa vigente en materia de protección de datos de salud.</li>
        </ul>
        <p>
          molari.ai no se hace responsable de información incorrecta que el asistente pueda proporcionar como resultado de una configuración incompleta o errónea por parte de la Clínica.
        </p>
      </Section>

      <Section title="4. Planes y pagos">
        <p>
          molari.ai ofrece distintos planes de suscripción. El plan Starter incluye un período de prueba gratuito de 30 días. Transcurrido ese período, la continuidad del servicio estará sujeta al pago de la suscripción correspondiente según el plan contratado.
        </p>
        <p>
          Los precios están expresados en dólares estadounidenses (USD) e incluyen IVA cuando corresponda según la normativa chilena. molari.ai se reserva el derecho de modificar sus precios con un aviso previo de 30 días.
        </p>
      </Section>

      <Section title="5. Propiedad de los datos">
        <p>
          Los datos de pacientes que se generen a través de la plataforma (nombre, RUT, correo, teléfono, historial de citas, conversaciones, odontogramas, cotizaciones y planes de tratamiento) pertenecen a la Clínica. molari.ai actúa como encargado del tratamiento de datos en los términos definidos en la Política de Privacidad y en el Acuerdo de Procesamiento de Datos (DPA) aplicable.
        </p>
        <p>
          molari.ai no utilizará los datos de los pacientes de la Clínica para entrenar modelos de inteligencia artificial propios ni para fines comerciales distintos a la prestación del servicio contratado.
        </p>
      </Section>

      <Section title="5a. Herramientas clínicas — odontograma, cotizaciones y planes de tratamiento">
        <p>
          La plataforma incluye herramientas de apoyo a la gestión clínica: odontograma digital, generador de cotizaciones y módulo de planes de tratamiento. Estas herramientas son de uso exclusivamente administrativo y de referencia interna de la Clínica.
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>El odontograma y las cotizaciones generadas en la plataforma no constituyen diagnóstico clínico ni prescripción médica. Son registros de referencia que deben ser validados por el profesional de salud a cargo.</li>
          <li>Los planes de tratamiento creados en la plataforma son documentos internos de la Clínica. La Clínica es responsable de obtener el consentimiento informado del paciente según la normativa sanitaria vigente.</li>
          <li>La Clínica es responsable de la exactitud de la información ingresada en estas herramientas y de su uso conforme a la ética profesional y la ley.</li>
        </ul>
      </Section>

      <Section title="6. Proveedores tecnológicos terceros">
        <p>
          molari.ai utiliza servicios de terceros para la prestación del servicio, entre ellos:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><strong>Modelos de inteligencia artificial:</strong> OpenRouter, Anthropic (Claude), Google (Gemini). Las conversaciones del chatbot pueden ser procesadas por estos proveedores según sus propios términos de uso.</li>
          <li><strong>Mensajería WhatsApp:</strong> Twilio y la API de WhatsApp Business de Meta. El uso de este canal está sujeto a las políticas de uso aceptable de Meta y Twilio. molari.ai no garantiza la disponibilidad continua del canal WhatsApp, ya que depende de la aprobación y continuidad de Meta.</li>
          <li><strong>Infraestructura en la nube:</strong> Railway y proveedores de base de datos. Los datos se almacenan en servidores ubicados en Estados Unidos con cifrado en tránsito y en reposo.</li>
        </ul>
        <p>
          La Clínica reconoce y acepta que el procesamiento de conversaciones puede involucrar a estos proveedores y sus respectivas jurisdicciones.
        </p>
      </Section>

      <Section title="7. Disponibilidad y limitación de responsabilidad">
        <p>
          molari.ai procura la disponibilidad continua del servicio, pero no garantiza un uptime del 100%. No será responsable por interrupciones causadas por fuerza mayor, fallas de terceros proveedores o mantenimientos programados.
        </p>
        <p>
          En ningún caso molari.ai será responsable por daños indirectos, lucro cesante ni pérdida de datos derivados del uso o imposibilidad de uso del servicio, salvo en caso de dolo o culpa grave.
        </p>
      </Section>

      <Section title="8. Cancelación y término">
        <p>
          La Clínica puede cancelar su suscripción en cualquier momento desde el panel de administración. La cancelación será efectiva al término del período de facturación en curso. molari.ai puede dar término al servicio en caso de incumplimiento de estos términos, con aviso previo de 15 días.
        </p>
      </Section>

      <Section title="9. Modificaciones">
        <p>
          molari.ai puede modificar estos Términos y Condiciones en cualquier momento. Las modificaciones serán notificadas por correo electrónico con al menos 15 días de anticipación. El uso continuado del servicio tras ese plazo implica la aceptación de los nuevos términos.
        </p>
      </Section>

      <Section title="10. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de la República de Chile. Cualquier controversia será sometida a los tribunales ordinarios de justicia de la ciudad de Santiago, renunciando las partes a cualquier otro fuero o jurisdicción.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Para consultas sobre estos Términos, puede escribirnos a{" "}
          <a href="mailto:hola@molari.ai" className="underline underline-offset-2">hola@molari.ai</a>.
        </p>
      </Section>
    </div>
  );
}
