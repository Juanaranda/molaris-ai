// Elimina bookings creados HOY sin pago registrado (importaciones de padrón del día)
import prisma from "../src/config/prisma";

async function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const n = await prisma.booking.count({
    where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: null, amountTotal: null },
  });
  console.log(`Bookings creados hoy sin pago: ${n}`);

  if (n === 0) { console.log("Nada que limpiar."); return; }

  const sample = await prisma.booking.findMany({
    where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: null, amountTotal: null },
    select: { patientName: true, patientRut: true, date: true },
    take: 5,
  });
  sample.forEach((r) => console.log(`  ${r.patientName} | rut: ${r.patientRut} | fecha: ${r.date.toISOString().slice(0, 10)}`));

  const { count } = await prisma.booking.deleteMany({
    where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: null, amountTotal: null },
  });
  console.log(`\n✓ Eliminados ${count} registros. Reimportá el CSV desde la UI.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
