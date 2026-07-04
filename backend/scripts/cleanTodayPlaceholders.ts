import prisma from "../src/config/prisma";

async function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const n = await prisma.booking.count({
    where: { date: { gte: today, lt: tomorrow }, paymentStatus: null, amountTotal: null },
  });
  console.log(`Bookings con fecha de hoy sin pago (placeholders de importación): ${n}`);

  if (n === 0) { console.log("Nada que limpiar."); return; }

  const { count } = await prisma.booking.deleteMany({
    where: { date: { gte: today, lt: tomorrow }, paymentStatus: null, amountTotal: null },
  });
  console.log(`✓ Eliminados ${count} placeholders. Reimportá el CSV desde la UI.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
