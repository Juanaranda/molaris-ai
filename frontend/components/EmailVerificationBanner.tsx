"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { Mail } from "lucide-react";

/**
 * Recordatorio para quien postergó confirmar su correo (#66). No bloquea el
 * panel a propósito: si el envío del código falla, dejar a un doctor afuera de
 * su agenda sería peor que tenerlo un rato sin verificar.
 *
 * `emailVerified` puede venir undefined desde un backend viejo; en ese caso no
 * se muestra nada, para no acusar en falso a quien sí está verificado.
 */
export function EmailVerificationBanner({ user }: { user: AuthUser | null }) {
  // Se llama antes del early-return: los hooks no pueden ir condicionados.
  const pathname = usePathname();
  if (!user || user.emailVerified !== false) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-sm"
      style={{ backgroundColor: "#FFF8E8", borderColor: "#F0C67C", color: "#7A5200" }}
    >
      <span className="text-base leading-none"><Mail className="w-4 h-4" aria-hidden /></span>
      <span className="flex-1 min-w-[14rem]">
        Tu correo <strong>{user.email}</strong> todavía no está confirmado. Sin
        esto no podemos ayudarte a recuperar tu contraseña.
      </span>
      <Link
        href={`/verificar-correo?next=${encodeURIComponent(pathname)}`}
        className="font-semibold underline underline-offset-2 whitespace-nowrap"
      >
        Confirmar ahora
      </Link>
    </div>
  );
}
