/**
 * Limpieza en dos pasadas:
 *  Pasada 1: borra bookings con fecha < 2000 o > 2030 (ya ejecutada)
 *  Pasada 2: borra bookings con fecha < 2024-01-01 que no tienen
 *            paymentStatus ni amountTotal — son registros de padrón CSV,
 *            no citas reales del sistema.
 *
 * Uso: npx tsx scripts/cleanBadImports.ts
 */

import prisma from "../src/config/prisma";

async function main() {
  // ── Vista previa ────────────────────────────────────────────────────────
  const total = await prisma.booking.count();
  console.log(`Total bookings en DB: ${total}`);

  const rosterLike = await prisma.booking.count({
    where: {
      date: { lt: new Date("2024-01-01T00:00:00Z") },
      paymentStatus: null,
      amountTotal: null,
    },
  });
  console.log(`Candidatos a borrar (pre-2024, sin pago registrado): ${rosterLike}`);

  if (rosterLike === 0) {
    console.log("Nada que limpiar. La DB parece estar bien.");
    return;
  }

  // ── Muestra de 5 ────────────────────────────────────────────────────────
  const sample = await prisma.booking.findMany({
    where: {
      date: { lt: new Date("2024-01-01T00:00:00Z") },
      paymentStatus: null,
      amountTotal: null,
    },
    select: { patientName: true, date: true, doctor: true, createdAt: true },
    take: 5,
  });
  console.log("\nMuestra de registros a eliminar:");
  sample.forEach((r) =>
    console.log(`  ${r.patientName} | fecha: ${r.date.toISOString().slice(0, 10)} | doctor: ${r.doctor} | creado: ${r.createdAt.toISOString().slice(0, 10)}`)
  );

  // ── Borrado ─────────────────────────────────────────────────────────────
  const { count } = await prisma.booking.deleteMany({
    where: {
      date: { lt: new Date("2024-01-01T00:00:00Z") },
      paymentStatus: null,
      amountTotal: null,
    },
  });

  console.log(`\n✓ Eliminados ${count} registros de padrón con fechas de nacimiento.`);
  console.log("Ahora reimportá el CSV desde la UI — las fechas quedarán en hoy.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
