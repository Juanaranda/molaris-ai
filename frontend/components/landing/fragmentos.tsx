import { cx } from "@/lib/cx";
import { CLINICA_EJEMPLO, type LineaChat } from "@/lib/landing";
import s from "./landing.module.css";

/**
 * Trozos del producto dibujados en HTML para la landing: la solicitud por
 * confirmar, el día del doctor, la ficha con el odontograma y la cuenta del
 * paciente. Son la "foto" de cada paso: se ven como el producto, con datos de
 * la clínica de ejemplo (inventados), y no reemplazan una captura real.
 *
 * Llevan `data-ui`: adentro valen las convenciones del producto (bordes de
 * 1px, radios chicos), no las de la página.
 */

export function Burbuja({ linea }: { linea: LineaChat }) {
  return (
    <p className={cx(s.burbuja, linea.quien === "paciente" ? s.paciente : s.molari)}>
      {linea.texto}
      <span className={s.hora}>{linea.hora}</span>
    </p>
  );
}

export function CabeceraChat({ detalle = "Asistente virtual · responde con IA" }: { detalle?: string }) {
  return (
    <div className={s.waCab}>
      <span className={s.av} aria-hidden>A</span>
      <div><b>{CLINICA_EJEMPLO}</b><small>{detalle}</small></div>
    </div>
  );
}

export function Solicitud() {
  return (
    <div className={cx(s.tarjeta, s.solicitud)} data-ui>
      <div className={s.solicitudCab}><h4>Camila Soto pidió hora</h4><span className={s.estado}>Por confirmar</span></div>
      <dl className={s.datos}>
        <dt>Qué</dt><dd>Limpieza</dd>
        <dt>Cuándo</dt><dd>Martes 21, 10:00</dd>
        <dt>Con</dt><dd>Dr. Muñoz · Box 1</dd>
        <dt>Llegó</dt><dd>WhatsApp, anoche 23:41</dd>
      </dl>
      <div className={s.acciones}>
        <span className={cx(s.btnUi, s.btnUiPrimario)}>Confirmar</span>
        <span className={s.btnUi}>Proponer otra hora</span>
      </div>
    </div>
  );
}

export function DiaAgenda() {
  const filas: [string, null | { quien: string; que: string; nueva?: boolean }][] = [
    ["09:00", { quien: "Tomás Fuentes", que: "Control de ortodoncia" }],
    ["09:30", null],
    ["10:00", { quien: "Camila Soto · confirmada", que: "Limpieza", nueva: true }],
    ["10:30", null],
    ["11:00", { quien: "Rosa Henríquez", que: "Evaluación" }],
  ];
  return (
    <div className={cx(s.tarjeta, s.dia)} data-ui>
      <div className={s.diaCab}>Martes 21 · Dr. Muñoz <span>Box 1</span></div>
      {filas.map(([hora, cita]) => (
        <div key={hora} className={s.fila}>
          <time>{hora}</time>
          {cita ? <div className={cx(s.cita, cita.nueva && s.citaNueva)}><b>{cita.quien}</b>{cita.que}</div> : <div />}
        </div>
      ))}
    </div>
  );
}

const SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function FichaOdontograma() {
  const pieza = (n: number) => (
    <span key={n} className={cx(s.pieza, n === 36 && s.piezaCaries, n === 26 && s.piezaObturada)}>{n}</span>
  );
  return (
    <div className={cx(s.tarjeta, s.ficha)} data-ui>
      <div className={s.solicitudCab}><h4>Camila Soto</h4><span className={s.fichaFecha}>Martes 21 · Box 1</span></div>
      <div className={s.pestanas}><span>Anamnesis</span><span>Notas</span><b>Odontograma</b></div>
      <div className={s.arcada}>{SUPERIOR.map(pieza)}</div>
      <div className={s.arcada}>{INFERIOR.map(pieza)}</div>
      <p className={s.nota}><b>Pieza 36 · caries oclusal</b>Dr. Muñoz, martes 21 a las 10:25</p>
    </div>
  );
}

export function CuentaPaciente() {
  return (
    <div className={cx(s.tarjeta, s.cuenta)} data-ui>
      <h4>Cuenta de Camila Soto</h4>
      <div className={s.mov}><span>Limpieza<small>Martes 21 · Dr. Muñoz</small></span><span>$35.000</span></div>
      <div className={s.mov}><span>Pago con débito<small>Martes 21, 10:48</small></span><span>−$35.000</span></div>
      <div className={s.mov}><span>Obturación pieza 36<small>Presupuesto aprobado · próxima cita</small></span><span>$45.000</span></div>
      <div className={cx(s.mov, s.saldo)}><span>Saldo pendiente</span><span>$45.000</span></div>
    </div>
  );
}
