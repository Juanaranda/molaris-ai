"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";

const links = [
  { href: "/dashboard",         label: "Resumen" },
  { href: "/dashboard/models",  label: "Modelos" },
  { href: "/dashboard/errors",  label: "Errores" },
  { href: "/dashboard/clinics", label: "Clínicas" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();

  function logout() { clearToken(); router.push("/login"); }

  return (
    <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-sm font-bold tracking-tight">molari.ai <span className="text-gray-400 font-normal">admin</span></span>
        <div className="flex gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${path === l.href ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <button onClick={logout} className="text-xs text-gray-400 hover:text-white transition-colors">Cerrar sesión</button>
    </nav>
  );
}
