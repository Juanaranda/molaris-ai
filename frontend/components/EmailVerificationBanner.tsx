"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser, ClinicData } from "@/lib/auth";
import { Mail, ShieldAlert } from "lucide-react";

/**
 * Aviso de verificación en el panel.
 *
 * - Clínica sin verificar (MOL-52): no puede cargar pacientes ni conectar
 *   WhatsApp hasta que quien la registró verifique correo o WhatsApp. El
 *   aviso dice qué está bloqueado y cómo destrabarlo.
 * - Clínica ya verificada pero con el correo sin confirmar (#66): solo un
 *   recordatorio, porque sin correo no se recupera la contraseña. Si verificó
 *   por WhatsApp no se insiste: con uno basta.
 *
 * Los campos pueden venir undefined desde un backend viejo; en ese caso no se
 * muestra nada, para no acusar en falso a quien sí está verificado.
 */
export function EmailVerificationBanner({ user, clinic }: { user: AuthUser | null; clinic?: ClinicData | null }) {
  // Se llama antes del early-return: los hooks no pueden ir condicionados.
  const pathname = usePathname();
  if (!user) return null;
  const enlace = `/verificar-correo?next=${encodeURIComponent(pathname)}`;
  const esAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  if (clinic?.contactoVerificado === false) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1 min-w-[14rem]">
          {esAdmin
            ? <>Verifica tu cuenta para <strong>cargar pacientes y conectar WhatsApp</strong>. Es un código por correo o por WhatsApp, con uno basta.</>
            : <>Esta clínica todavía no está verificada: quien la administra tiene que confirmar su cuenta antes de cargar pacientes.</>}
        </span>
        {esAdmin && (
          <Link href={enlace} className="font-semibold underline underline-offset-2 whitespace-nowrap">
            Verificar ahora
          </Link>
        )}
      </div>
    );
  }

  if (user.emailVerified !== false || user.phoneVerified) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
      <Mail className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-[14rem]">
        Tu correo <strong>{user.email}</strong> todavía no está confirmado. Sin
        esto no podemos ayudarte a recuperar tu contraseña.
      </span>
      <Link href={enlace} className="font-semibold underline underline-offset-2 whitespace-nowrap">
        Confirmar ahora
      </Link>
    </div>
  );
}
