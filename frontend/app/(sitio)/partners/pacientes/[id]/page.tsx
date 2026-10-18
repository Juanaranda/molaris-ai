import { paramsEstaticos } from "@/lib/rutasApp";
import { Suspense } from "react";
import Pagina from "./Pagina";

// La página es de cliente; este envoltorio solo existe para declarar los
// parámetros que exige el build de la app (export estático, MOL-40). El
// Suspense lo pide Next para pre-generar páginas que leen la query.
export function generateStaticParams() {
  return paramsEstaticos("id");
}

export default function Page() {
  return <Suspense><Pagina /></Suspense>;
}
