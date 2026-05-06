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
      <div className="rounded-2xl p-5 border text-sm flex flex-col gap-1"
        style={{ backgroundColor: "#E8F3F7", borderColor: "#B8D9EA", color: "#0B2F42" }}>
        <p className="font-semibold text-base">Demo en vivo de molari.ai</p>
        <p style={{ color: "#1A5C7A" }}>
          Estás hablando con <strong>Juan</strong>, el agente de molari.ai. Él te explicará cómo funciona el sistema y cómo sería el asistente real de tu clínica.{" "}
          <Link href="/register" className="font-semibold underline underline-offset-2 hover:opacity-80">
            Registra tu clínica gratis →
          </Link>
        </p>
      </div>
      <ChatDemo clinicSlug={slug} isDemoMode={true} />
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
