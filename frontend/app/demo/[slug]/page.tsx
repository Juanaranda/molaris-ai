"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatDemo } from "@/components/ChatDemo";

function DemoContent({ slug }: { slug: string }) {
  const params = useSearchParams();
  const isWelcome = params.get("welcome") === "1";

  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
      {isWelcome && (
        <div className="rounded-2xl p-5 border text-sm flex flex-col gap-1"
          style={{ backgroundColor: "#EEF7F3", borderColor: "#A8D5C2", color: "#1B6B4A" }}>
          <p className="font-semibold text-base">¡Bienvenido a molari.ai! 🎉</p>
          <p style={{ color: "#2D8A62" }}>
            Este es tu asistente virtual configurado para tu clínica. Pruébalo ahora y cuando estés listo,{" "}
            <Link href="/partners/dashboard" className="font-semibold underline underline-offset-2 hover:opacity-80">
              ve al panel para agregar tus doctores y servicios →
            </Link>
          </p>
        </div>
      )}
      <ChatDemo clinicSlug={slug} />
    </div>
  );
}

export default function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--surface, #F7F5F1)" }}>
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#E5E0D9" }}>
        <Link href="/" className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--teal-dark, #0B2F42)" }}>
          ← molari.ai
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--ink-muted, #607281)" }}>
            Demo en vivo
          </span>
          <Link href="/partners/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--teal-dark, #0B2F42)", color: "white" }}>
            Mi panel →
          </Link>
        </div>
      </nav>
      <Suspense fallback={<div className="flex-1" />}>
        <DemoContent slug={slug} />
      </Suspense>
    </div>
  );
}
