import Link from "next/link";

export const metadata = { title: "Política de Privacidad — molari.ai" };

const LAST_UPDATED = "23 de abril de 2026";

export default function PrivacidadPage() {
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
          Política de Privacidad
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--ink-muted, #607281)" }}>
          Última actualización: {LAST_UPDATED}
        </p>

        <PrivacyContent />

        <div className="mt-12 pt-8 border-t flex flex-wrap gap-4 text-sm" style={{ borderColor: "#E5E0D9", color: "var(--ink-muted, #607281)" }}>
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
      <h2 className="text-lg font-bold mb-3" style={{ color: "var(--ink, #0C1B26)" }}>{title}</h2>
      <div className="text-sm leading-relaxed flex flex-col gap-3" style={{ color: "var(--ink-muted, #607281)" }}>
        {children}
      </div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <div>
      <Section title="1. Responsable del tratamiento">
        <p>
          molari.ai (en adelante &quot;molari.ai&quot;, &quot;nosotros&quot; o &quot;el Proveedor&quot;) opera la plataforma de asistente virtual para clínicas dentales disponible en molari.ai. Esta Política describe cómo tratamos los datos personales en el contexto de la prestación de nuestros servicios.
        </p>
        <p>
          molari.ai actúa como <strong>encargado del tratamiento</strong> de los datos de pacientes, en nombre de las clínicas que contratan el servicio (responsables del tratamiento). Para los datos de los usuarios administradores de la plataforma, molari.ai actúa como responsable.
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <p><strong>De las clínicas (usuarios administradores):</strong></p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Nombre, correo electrónico y contraseña cifrada</li>
          <li>Información de la clínica: nombre, teléfono, ubicación, redes sociales</li>
          <li>Fecha y hora de aceptación de términos (registro electrónico)</li>
          <li>Datos de uso de la plataforma (accesos, configuraciones)</li>
        </ul>
        <p><strong>De los pacientes de las clínicas (a través del asistente virtual):</strong></p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Nombre completo y RUT (cuando el paciente los proporciona voluntariamente)</li>
          <li>Correo electrónico (cuando el paciente lo proporciona)</li>
          <li>Historial de conversaciones con el asistente</li>
          <li>Información de servicio de interés, urgencia e intención de agendamiento</li>
          <li>Datos de reservas: fecha, hora, profesional seleccionado</li>
        </ul>
      </Section>

      <Section title="3. Base legal del tratamiento">
        <p>
          El tratamiento de datos se rige por la Ley N° 19.628 sobre Protección de la Vida Privada y la Ley N° 21.719 (vigente desde 2026). Las bases legales que sustentan el tratamiento son:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><strong>Ejecución de contrato:</strong> para los datos de usuarios administradores de clínicas.</li>
          <li><strong>Consentimiento:</strong> para los datos de pacientes, otorgado al iniciar una conversación con el asistente. La clínica es responsable de informar a sus pacientes sobre este tratamiento.</li>
          <li><strong>Interés legítimo:</strong> para datos de uso y mejora del servicio, de forma anonimizada.</li>
        </ul>
      </Section>

      <Section title="4. Categorías especiales — datos de salud">
        <p>
          Las consultas realizadas por los pacientes pueden contener información relacionada con su salud (tipo de tratamiento, urgencias, condiciones médicas). Estos datos son considerados sensibles bajo la legislación chilena.
        </p>
        <p>
          molari.ai trata estos datos exclusivamente para la finalidad de facilitar la atención y agendamiento en la clínica correspondiente. No comparte estos datos con terceros para fines comerciales ni los utiliza para entrenar modelos de inteligencia artificial propios.
        </p>
      </Section>

      <Section title="5. Finalidades del tratamiento">
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Operar el asistente virtual y responder consultas de pacientes</li>
          <li>Facilitar el agendamiento de citas</li>
          <li>Generar informes de leads y scoring para la clínica</li>
          <li>Mejorar la calidad del servicio (con datos anonimizados)</li>
          <li>Cumplir obligaciones legales y contractuales</li>
        </ul>
      </Section>

      <Section title="6. Transferencia a terceros">
        <p>
          Para prestar el servicio, molari.ai utiliza los siguientes proveedores tecnológicos que pueden procesar datos:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><strong>OpenRouter / Anthropic:</strong> procesamiento de lenguaje natural para generar respuestas del asistente. Las conversaciones pueden transmitirse a estos servicios de forma cifrada.</li>
          <li><strong>Proveedor de base de datos:</strong> almacenamiento seguro de datos en servidores con protocolos de seguridad estándar.</li>
        </ul>
        <p>
          Estos proveedores actúan como subencargados del tratamiento y están sujetos a sus propias políticas de privacidad y estándares de seguridad.
        </p>
      </Section>

      <Section title="7. Derechos de los titulares">
        <p>
          Los pacientes y usuarios administradores pueden ejercer los siguientes derechos:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><strong>Acceso:</strong> solicitar qué datos personales almacenamos sobre usted</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos</li>
          <li><strong>Cancelación/Eliminación:</strong> solicitar la eliminación de sus datos</li>
          <li><strong>Oposición:</strong> oponerse al tratamiento en determinadas circunstancias</li>
        </ul>
        <p>
          Las solicitudes de los pacientes deben dirigirse a la clínica con la que interactuaron, quien es el responsable del tratamiento de sus datos. Para solicitudes relacionadas con la plataforma, escribir a{" "}
          <a href="mailto:privacidad@molari.ai" className="underline underline-offset-2">privacidad@molari.ai</a>.
        </p>
      </Section>

      <Section title="8. Retención de datos">
        <p>
          Los datos de conversaciones y leads se conservan mientras la clínica mantenga su suscripción activa. Tras la cancelación del servicio, los datos se eliminan en un plazo máximo de 90 días, salvo que exista obligación legal de conservarlos por un período mayor.
        </p>
      </Section>

      <Section title="9. Seguridad">
        <p>
          molari.ai implementa medidas técnicas y organizativas para proteger los datos personales: cifrado en tránsito (TLS), acceso restringido por roles, contraseñas almacenadas con hash bcrypt y monitoreo de accesos. Sin embargo, ningún sistema es 100% seguro y no podemos garantizar la seguridad absoluta de la información.
        </p>
      </Section>

      <Section title="10. Modificaciones">
        <p>
          Esta Política puede actualizarse periódicamente. Las clínicas serán notificadas por correo electrónico ante cambios relevantes. La versión vigente siempre estará disponible en esta página con su fecha de última actualización.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Para consultas sobre privacidad y protección de datos:{" "}
          <a href="mailto:privacidad@molari.ai" className="underline underline-offset-2">privacidad@molari.ai</a>
        </p>
      </Section>
    </div>
  );
}
