/**
 * Validación y formato de RUT chileno (módulo 11).
 * Base para la verificación de identidad de clínicas y profesionales (KYC).
 */

/** Quita puntos, guiones y espacios; normaliza el dígito verificador a mayúscula. */
export function cleanRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

/** Calcula el dígito verificador de un cuerpo de RUT (solo dígitos, sin DV). */
export function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** true si el RUT es válido (formato + dígito verificador). */
export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return computeDv(body) === dv;
}

/** Formatea un RUT a "12.345.678-5". Devuelve el original si no es parseable. */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
