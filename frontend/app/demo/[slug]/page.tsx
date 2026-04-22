"use client";

import { use } from "react";
import Link from "next/link";
import { ChatDemo } from "@/components/ChatDemo";

export default function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-gray-800 hover:text-gray-600 transition-colors">
          ← molaris.ai
        </Link>
        <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">Demo en vivo</span>
      </nav>
      <div className="flex-1 max-w-xl mx-auto w-full px-4 py-10">
        <ChatDemo clinicSlug={slug} />
      </div>
    </div>
  );
}
