# molari.ai — Contexto del proyecto

## Qué es
AI Growth System para clínicas dentales chilenas. Monorepo:
- `backend/` → Fastify + OpenRouter + Prisma + PostgreSQL (puerto 3001)
- `frontend/` → Next.js 16 + Tailwind v4 (puerto 3000)
- `admin/` → Next.js 16, panel interno (puerto 3002)
- Cliente piloto: **Galana Clínica Dental**, Santiago de Chile

Next 16 trae cambios de API respecto de las versiones que la mayoría conoce.
`frontend/AGENTS.md` obliga a leer los docs locales en `node_modules/next/dist/docs/`
antes de escribir código — ahí se detectó, por ejemplo, que `priority` en `<Image>`
está deprecado desde la 16.

## Modo de operación
- **Operar con autonomía** — no preguntar cómo avanzar tras cada tarea
- Seguir el roadmap de prioridades y ejecutar el siguiente paso directamente
- Solo pausar ante: decisiones de negocio, cambios de arquitectura, acciones irreversibles en producción

## Roadmap de prioridades
1. 🔴 chat e2e ✅ · widget embebible ✅ · notificación al agendar
2. 🟡 dashboard de leads · formulario de onboarding · pricing page
3. 🟢 WhatsApp Business API · Reservo API · modelo de scoring propio

## Git
- Trabajar siempre en `dev` → PR a `beta` → PR a `main`
- Nunca pushear directo a `main`
- Nunca commitear `.env`, `node_modules/`, `backend/src/generated/`

## Doctores Galana
Equipo y horarios confirmados por la clínica (ago 2026). Se ajustan desde el
editor de equipo cuando cambien.

El prefijo va "Dr." parejo para no deducir el género desde el nombre; cuando
la clínica confirme quién lleva "Dra.", se corrige.

Dr. Ivonne Poblete (Cirujano Dentista) · Dr. Juan Garcés (Endodoncia)
Dr. Javiera Paimilla (Cirujano Dentista) · Dr. Nicolás Rojas (Cirujano Dentista)
Dr. Yamileth Zerpa (Ortodoncia) · 2 boxes, rotación libre

---

# Cómo trabajar en este repo

## Reglas que no se negocian

- Nunca commitear secretos, credenciales ni `.env`
- Nunca pushear directo a `main` — el flujo es `dev` → `beta` → `main`
- Usar `prisma db push`, NUNCA `migrate dev` (genera drift y borra datos)
- No commitear `node_modules/` ni `backend/src/generated/`
- Leer un archivo antes de editarlo
- Validar la entrada del usuario en los bordes del sistema (rutas, webhooks, formularios)
- Sanitizar rutas de archivo para evitar directory traversal

## Alcance

- Hacer lo que se pidió: ni menos, ni de más
- No crear archivos si no hacen falta; preferir editar uno que exista
- No crear documentación ni README salvo que se pidan explícitamente
- Los archivos de trabajo temporales van al scratchpad de la sesión, nunca al repo

## Dónde va cada cosa

Monorepo con tres paquetes, cada uno con sus dependencias:

| | |
|---|---|
| `backend/` | Fastify + Prisma. Código en `src/`, tests en `src/__tests__/` |
| `frontend/` | Next.js. Rutas en `app/`, componentes en `components/`, helpers en `lib/`, tests en `__tests__/` |
| `admin/` | Next.js aparte, panel interno (puerto 3002) |
| `docs/` · `scripts/` | documentación y utilidades |

La lógica de negocio que se pueda probar sin montar una pantalla va a `lib/`
(frontend) o a `services/` (backend), no dentro del componente o la ruta. Es lo
que permitió cubrir con tests la validación del onboarding, los plazos de
confirmación y la orientación del odontograma.

## Build y tests

```bash
npm run build                      # construye los tres paquetes
npm run dev                        # levanta backend + frontend + admin

npx tsc --noEmit                   # por paquete
npx vitest run                     # por paquete
npx eslint .                       # solo frontend y admin
```

- No hay `npm test` ni `npm run lint` en la raíz: se corren dentro de cada paquete
- Correr los tests después de cambiar código, y verificar que el build pase antes de commitear
- Ojo con `tail` en las verificaciones: se traga el código de salida y un fallo
  puede pasar por verde. Mirar el exit code de verdad.

## Criterios de diseño

- Interfaces tipadas en todo lo que cruce un límite público
- Dividir un archivo cuando mezcla asuntos que no tienen que ver, o cuando la
  misma lógica empieza a vivir en dos lados — no por cantidad de líneas
- El odontograma usa event sourcing (`DentalEvent`) por trazabilidad
  médico-legal. Es una decisión de ese dominio, no un patrón general del repo.

## Contexto legal que cambia decisiones

- Las fichas clínicas son documento médico-legal (Ley 20.584): "ya no atiende"
  nunca significa "borrar"
- Datos personales bajo Ley 21.719
- Todo texto legal o tributario es BORRADOR hasta que lo valide un abogado
