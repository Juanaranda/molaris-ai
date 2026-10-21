import Image from "next/image";
import Link from "next/link";
import { SalesChat } from "@/components/SalesChat";
import { AgentFlowDiagram } from "@/components/AgentFlowDiagram";
import { ChatEnVivo } from "@/components/landing/ChatEnVivo";
import { Recorrido } from "@/components/landing/Recorrido";
import { LoQueTrae } from "@/components/landing/LoQueTrae";
import { Preguntas } from "@/components/landing/Preguntas";
import { Aparece } from "@/components/landing/Aparece";
import { CierreRegistro } from "@/components/landing/CierreRegistro";
import { CLINICA_EJEMPLO, COMPARACION, PLANES } from "@/lib/landing";
import { cx } from "@/lib/cx";
import s from "@/components/landing/landing.module.css";

/* Landing (rediseño oct 2026, dirección "el producto en vivo"): el producto
   haciendo su trabajo, desde el WhatsApp del paciente hasta la silla. Los
   textos y datos de ejemplo viven en lib/landing.ts, con sus tests. */

/* Muestra el chat de Juan (agente comercial). Se lee en build: cambiarlo en
   Vercel exige redeploy, no basta con guardar la variable.
   Prenderlo solo en ambientes donde exista la clínica "molaris-demo" — si no,
   el chat aparece y contesta "Sin respuesta" a cualquier visitante.
   Sin la variable seteada queda visible en local y oculto en beta/prod. */
const salesChatEnabled =
  process.env.NEXT_PUBLIC_SALES_CHAT === "true" ||
  (process.env.NEXT_PUBLIC_SALES_CHAT !== "false" &&
    process.env.NODE_ENV !== "production");

/**
 * La clínica de ejemplo del diagrama del agente. Va con el rótulo "Ejemplo" a
 * la vista: son datos de muestra, no los de un cliente.
 */
const CLINICA_DE_EJEMPLO = {
  assistantName: "Sofía",
  tone: "cercano y profesional",
  doctors: [1, 2, 3],
  services: [1, 2, 3, 4, 5, 6],
  schedule: { weekdays: "Lunes a Viernes: 09:00 - 19:00" },
  whatsapp: "569XXXXXXXX",
  // Sin Instagram: el diagrama lo listaría como canal de entrada y molari
  // todavía no responde mensajes de Instagram.
};

const WHATSAPP_VENTAS = "https://wa.me/56966865887";

export default function Home() {
  return (
    <main className={s.pagina}>
      <header className={s.barra}>
        <Image src="/logo.svg" alt="molari.ai" width={124} height={43} style={{ height: "auto" }} preload />
        <nav aria-label="Principal">
          <a className={s.ocultar} href="#recorrido">Cómo funciona</a>
          <a className={s.ocultar} href="#funciones">Funciones</a>
          <a className={s.ocultar} href="#precios">Precios</a>
          <Link href="/login">Acceder</Link>
          <Link className={cx(s.boton, s.ocultar)} href="/register">Prueba gratis</Link>
        </nav>
      </header>

      {/* ── Hero: el título partido y el chat al medio ─────────────────────── */}
      <section className={s.hero} aria-label="Presentación">
        <h1 className={s.titulo}>
          <span>Desde<br /> WhatsApp</span> <span>hasta tu<br /> silla.</span>
        </h1>

        <div className={s.cinta}>
          <ChatEnVivo />
        </div>

        <ul className={s.incluye} aria-label="Lo que incluye">
          <li>Recepción con IA</li>
          <li>Agenda por doctor y box</li>
          <li>Ficha clínica y odontograma</li>
          <li>Presupuestos y pagos</li>
        </ul>

        <div className={s.bajadaHero}>
          <p>Todo el software de tu clínica o consulta dental, con una recepción con IA que contesta por WhatsApp a cualquier hora y deja la hora pedida para que tú la confirmes.</p>
          <Link className={s.boton} href="/register">Prueba molari gratis</Link>
          {process.env.NEXT_PUBLIC_LIVE_CLINIC_LABEL && (
            <p className={s.senal}>
              <span className="punto-vivo" aria-hidden />
              Atendiendo pacientes ahora en {process.env.NEXT_PUBLIC_LIVE_CLINIC_LABEL}
            </p>
          )}
        </div>
      </section>

      <Recorrido />

      <LoQueTrae
        foto={<Image src="/photos/doctora-laptop.jpg" alt="Una profesional revisa la agenda de la clínica en su computador" width={1200} height={800} sizes="(max-width: 900px) 100vw, 38vw" className={s.foto} />}
      />

      {/* ── Confianza: qué hace el agente y con qué datos ───────────────────── */}
      <section className={cx(s.seccion, s.blanco)} aria-labelledby="t-confianza">
        <div className={s.confianza}>
          <Aparece>
            <h2 id="t-confianza" className={s.h2}>Sabes exactamente qué hace</h2>
            <p className={s.intro}>
              Cada mensaje pasa por estos pasos, con los datos de tu clínica. Ninguna hora entra a tu agenda sin que tú la confirmes.
            </p>
            <ul className={s.puntos}>
              <li><b>El paciente sabe que habla con una IA.</b>{" "}Se lo avisamos antes de conversar.</li>
              <li><b>Cada registro tiene autor y fecha.</b>{" "}Las fichas clínicas no se borran.</li>
              <li><b>Cifrado en tránsito y en reposo.</b>{" "}Los datos viajan y se guardan cifrados.</li>
              <li><b>Tus datos son tuyos.</b>{" "}Descarga tu lista de pacientes en CSV cuando quieras.</li>
            </ul>
          </Aparece>
          <Aparece retraso={90} className={s.diagrama} ui>
            <p className={s.ejemploCab}>{CLINICA_EJEMPLO} · ejemplo</p>
            <AgentFlowDiagram compact config={CLINICA_DE_EJEMPLO} />
          </Aparece>
        </div>
      </section>

      {/* ── Juan: el agente comercial, de verdad (detrás de un flag) ────────── */}
      {salesChatEnabled && (
        <section id="juan" className={cx(s.seccion, s.oscuro)} aria-labelledby="t-juan">
          <div className={s.juan}>
            <div>
              <h2 id="t-juan" className={s.h2}>¿Dudas? Pregúntale a Juan.</h2>
              <p className={s.intro}>
                Juan es el asistente con IA de molari. Conoce los planes y cómo funciona todo. Pregúntale lo que quieras, sin compromiso.
              </p>
              <ul>
                <li>¿Cuánto cuesta y qué incluye cada plan?</li>
                <li>¿Cómo funciona el agendamiento?</li>
                <li>¿Se puede usar con mi WhatsApp actual?</li>
              </ul>
            </div>
            {/* Es el chat real del producto: valen sus propias convenciones. */}
            <div data-ui><SalesChat /></div>
          </div>
        </section>
      )}

      {/* ── Precios: tabla grande ──────────────────────────────────────────── */}
      <section id="precios" className={s.seccion} aria-labelledby="t-precios">
        <h2 id="t-precios" className={s.h2}>Precios</h2>

        <table className={s.tablaPrecios}>
          <caption className="sr-only">Planes de molari y qué incluye cada uno</caption>
          <thead>
            <tr>
              <td />
              {PLANES.map((p) => (
                <th key={p.id} scope="col" className={cx(p.destacado && s.destacado)}>
                  <b>{p.nombre}</b>
                  <span className={s.precio}>{p.precio}{p.periodo && <small>{p.periodo}</small>}</span>
                  <span className={s.para}>{p.para}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARACION.map((fila) => (
              <tr key={fila.que}>
                <th scope="row">{fila.que}</th>
                {fila.valores.map((v, i) => (
                  <td key={PLANES[i].id} className={cx(v === "No incluido" && s.no, PLANES[i].destacado && s.destacado)}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              {PLANES.map((p) => (
                <td key={p.id} className={cx(p.destacado && s.destacado)}>
                  <Link className={s.boton} href={p.accion.href}>{p.accion.texto}</Link>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        {/* En el celular cada plan es un bloque con sus filas. */}
        <div className={s.precioCelular}>
          {PLANES.map((p, i) => (
            <div key={p.id} className={cx(s.bloquePlan, p.destacado && s.bloqueDestacado)}>
              <h3>{p.nombre}</h3>
              <span className={s.precio}>{p.precio}{p.periodo && <small>{p.periodo}</small>}</span>
              <span className={s.para}>{p.para}</span>
              <dl>
                {COMPARACION.map((fila) => (
                  <div key={fila.que}><dt>{fila.que}</dt><dd>{fila.valores[i]}</dd></div>
                ))}
              </dl>
              <Link className={s.boton} href={p.accion.href}>{p.accion.texto}</Link>
            </div>
          ))}
        </div>

        <p className={s.notaPrecio}>Pesos chilenos al mes. Sin contratos largos: cancelas cuando quieras.</p>
      </section>

      <Preguntas
        foto={<Image src="/photos/dentista-paciente.jpg" alt="Un dentista conversa con su paciente sentada en el sillón" width={1200} height={900} sizes="(max-width: 900px) 100vw, 45vw" className={s.foto} />}
      />

      {/* ── Cierre: el primer paso, ya abierto ─────────────────────────────── */}
      <section className={cx(s.seccion, s.oscuro)} aria-labelledby="t-cierre">
        <div className={s.cierre}>
          <div>
            <h2 id="t-cierre" className={s.h2}>Regístrate hoy, con tu clínica o solo.</h2>
            <p>Sirve para clínicas con equipo y para quien atiende solo. Elige cómo trabajas y sigue con el registro: son dos pasos.</p>
            <Image src="/photos/box-moderno.jpg" alt="Un box dental vacío, con el sillón listo para el próximo paciente" width={1200} height={800} sizes="(max-width: 900px) 100vw, 40vw" className={cx(s.foto, s.fotoCierre)} />
          </div>
          <CierreRegistro />
        </div>
      </section>

      <footer className={s.pie}>
        <span>molari.ai · software dental con recepción IA</span>
        <nav aria-label="Pie de página">
          <Link href="/legal/terminos">Términos</Link>
          <Link href="/legal/privacidad">Privacidad</Link>
          <a href={WHATSAPP_VENTAS}>WhatsApp</a>
          <Link href="/login">Acceder</Link>
        </nav>
        <span>© {new Date().getFullYear()} · Santiago, Chile</span>
      </footer>
    </main>
  );
}
