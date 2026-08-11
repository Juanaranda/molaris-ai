import { PrismaClient } from "@prisma/client";

/**
 * Backfill único para la verificación de correo (#66).
 *
 * Las cuentas que ya existían cuando se agregó la verificación no pasaron por el
 * flujo del código, así que quedan con emailVerifiedAt null — indistinguibles de
 * una cuenta nueva sin verificar. Sin este backfill, todos los clientes actuales
 * verían de golpe el cartel de "confirma tu correo" por algo que nunca se les
 * pidió.
 *
 * Se da por verificado solo lo anterior al corte. Cualquier registro posterior
 * pasa por el flujo normal.
 *
 *   npx tsx scripts/backfillEmailVerified.ts            → dry-run (no escribe)
 *   npx tsx scripts/backfillEmailVerified.ts --apply    → escribe
 */

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const pendientes = await prisma.partnerUser.findMany({
    where: { emailVerifiedAt: null },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (pendientes.length === 0) {
    console.log("No hay cuentas sin verificar. Nada que hacer.");
    return;
  }

  console.log(`${pendientes.length} cuenta(s) sin emailVerifiedAt:\n`);
  for (const u of pendientes) {
    console.log(`  ${u.createdAt.toISOString().slice(0, 10)}  ${u.email.padEnd(32)} ${u.name}`);
  }

  if (!APPLY) {
    console.log(`\nDry-run — no se escribió nada. Corre con --apply para marcarlas como verificadas.`);
    return;
  }

  const now = new Date();
  const { count } = await prisma.partnerUser.updateMany({
    // Se re-afirma emailVerifiedAt: null dentro del updateMany: si alguien
    // verificó su correo entre el listado y este update, no se le pisa la fecha.
    where: { id: { in: pendientes.map((u) => u.id) }, emailVerifiedAt: null },
    data: { emailVerifiedAt: now, emailVerifyCodeHash: null, emailVerifyExpiresAt: null },
  });

  console.log(`\n✅ ${count} cuenta(s) marcadas como verificadas (${now.toISOString()}).`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
