"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!localStorage.getItem("admin_token")) router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
