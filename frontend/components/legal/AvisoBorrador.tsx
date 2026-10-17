/**
 * Aviso de que un texto legal no está validado por un abogado.
 *
 * Regla del proyecto: todo texto legal es BORRADOR hasta que lo valide un
 * abogado. Solo el DPA lo decía; la política de privacidad y los términos se
 * mostraban como definitivos (detectado al armar la carpeta para revisión
 * legal, 17 oct). Se quita cuando el abogado valide cada documento.
 */
export function AvisoBorrador() {
  return (
    <div role="note" className="mb-8 rounded-control border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
      <strong>BORRADOR — pendiente de validación legal.</strong> Este documento es una plantilla
      operativa y no constituye asesoría legal. Debe ser revisado por un abogado antes de su uso
      definitivo.
    </div>
  );
}
