# Handoff Spec: molari.ai — Landing Page (`/`)

> **Stack:** Next.js 15 (App Router) · Tailwind CSS v4 · Plus Jakarta Sans · TypeScript  
> **File:** `frontend/app/page.tsx`  
> **Last updated:** 2026-05-23

---

## Overview

Landing page de marketing para molari.ai, un AI Growth System para clínicas dentales chilenas. La página convierte visitas frías en registros y demos. Tiene 10 secciones en scroll vertical con fondo alternante claro/oscuro para crear ritmo visual.

---

## Design Tokens

Definidos en `frontend/app/globals.css` como CSS custom properties en `:root`.

### Colores

| Token | Valor | Uso |
|-------|-------|-----|
| `--ink` | `#0C1B26` | Texto primario |
| `--ink-muted` | `#607281` | Texto secundario, subtítulos |
| `--surface` | `#F7F5F1` | Fondo de página (secciones claras alternas) |
| `--surface-white` | `#FDFCFB` | Nav, tarjetas, fondos de cards |
| `--teal-dark` | `#0B2F42` | Secciones oscuras (pilares, agenda, CTA) |
| `--teal-mid` | `#1A5C7A` | Color primario de marca, links, iconos |
| `--teal-light` | `#E8F3F7` | Backgrounds tint para badges e iconos teal |
| `--coral` | `#D95F45` | CTA principal, acento, numeración decorativa |
| `--coral-light` | `#FDECEA` | Background tint para coral |
| `--border` | `#E5E0D9` | Bordes de tarjetas y separadores |

### Paleta Teal extendida (para gradientes o sombras)

```
#EFF6FA → #D4E9F2 → #A9D3E5 → #4A9EC4 → #1A5C7A → #124459 → #0B2F42 → #071E2B
```

### Tipografía

| Token | Valor | Uso |
|-------|-------|-----|
| `--font-family-display` | Plus Jakarta Sans | Headings, precios, numeración |
| `--font-family-body` | Plus Jakarta Sans | Todo el cuerpo |
| Hero h1 | `text-5xl` / `text-6xl` sm, `font-bold`, `leading-[1.08]`, `tracking-tight` | Título principal |
| Section h2 | `text-3xl` / `text-4xl` sm, `font-bold` | Encabezados de sección |
| Card h3 | `text-base`–`text-lg`, `font-semibold`/`font-bold` | Títulos de tarjetas |
| Eyebrow | `text-xs`, `font-bold`, `uppercase`, `tracking-[0.15em]` | Etiquetas sobre h2 |
| Body | `text-sm`–`text-base`, `leading-relaxed` | Párrafos descriptivos |
| Caption | `text-xs`–`text-[10px]` | Subtextos, métricas pequeñas |

### Espaciado

| Uso | Clase Tailwind |
|-----|---------------|
| Padding horizontal de sección | `px-6 sm:px-10` |
| Padding vertical sección estándar | `py-14 sm:py-20` |
| Padding vertical sección grande | `py-16 sm:py-24` |
| Gap de grilla (cards) | `gap-5` / `gap-6` |
| Gap de grilla (teléfonos) | `gap-10` |
| Max width contenido estándar | `max-w-4xl` (896px) |
| Max width contenido amplio | `max-w-5xl` (1024px) |
| Max width hero | `max-w-6xl` (1152px) |

### Border radius

| Uso | Valor |
|-----|-------|
| Tarjetas estándar | `rounded-2xl` (16px) |
| Tarjetas grandes (features) | `rounded-3xl` (24px) |
| Botones CTA | `rounded-full` |
| Iconos/badges | `rounded-full` o `rounded-2xl` |
| Badges de texto | `rounded-full` |

---

## Layout y Grid

### Breakpoints relevantes

| Breakpoint | Ancho | Comportamiento |
|------------|-------|----------------|
| Mobile | < 640px | 1 columna, padding reducido, texto más pequeño |
| `sm` | ≥ 640px | 2–4 columnas en grillas, padding completo |
| `lg` | ≥ 1024px | 2–3 columnas en secciones hero/features |

### Estructura de página

```
NAV (sticky, fondo --surface-white)
├── HERO (--surface, 2 cols lg: texto + HeroShowcase)
├── PILARES (--teal-dark, 4 cols sm)
├── PROBLEMAS (--surface, 3 cols sm)
├── FEATURES (--surface-white, 3 cols lg)
├── PLATAFORMAS (--surface, 3 cols sm + métricas)
├── AGENDA (--teal-dark, 2 cols lg)
├── CÓMO FUNCIONA (--surface-white, 4 cols sm)
├── PRICING (--surface, 3 cols sm)
├── CTA (--teal-dark, centrado)
└── FOOTER (--surface-white, border-top)
```

---

## Componentes

### Nav

- **Fondo:** `#FDFCFB` con `border-b` color `--border`
- **Logo:** `<Image>` SVG, 148×38px
- **Links de navegación:** Ocultos en mobile (`hidden sm:block`), color `--ink-muted`, hover → `--ink` (implementar `hover:text-[#0C1B26]`)
- **CTA "Ver demo":** `rounded-full`, fondo `--coral`, texto blanco, `hover:opacity-90`
- **Estado mobile:** Solo logo + "Acceder" + "Ver demo"

### Hero

- **Grid:** `grid-cols-1 lg:grid-cols-2`, gap `gap-12 lg:gap-16`
- **Badge eyebrow:** fondo `--teal-light`, color `--teal-mid`, borde `rgba(26,92,122,0.2)`, incluye dot animado `animate-pulse` coral
- **h1 color accent:** `--coral` en el span de "automatizada de verdad."
- **CTA primario:** fondo `--coral`, `box-shadow: 0 8px 30px rgba(217,95,69,0.35)`, `hover:scale-[1.02]`, `active:scale-[0.98]`
- **Badge "En producción":** fondo `--teal-light`, dot `animate-pulse` teal
- **HeroShowcase:** flota continuamente con `animate-float-slow` (ver sección Animaciones)
- **Animaciones de carga:** `animate-fade-up` con delays escalonados (0 → 0.1s → 0.2s → 0.32s)

### Pilares (strip oscuro)

- **4 items en grid** `grid-cols-2 sm:grid-cols-4`
- Cada item: emoji 2xl + label bold blanco + descripción `rgba(255,255,255,0.45)`
- Animación: `AnimateIn` con stagger de 90ms entre items

### Tarjetas de Problema

- **Border top accent:** `2.5px solid --coral`
- **Numeración decorativa:** `text-5xl font-display`, color `rgba(217,95,69,0.18)` — decorativa, no semántica
- **box-shadow:** `0 1px 3px rgba(12,27,38,0.05)`
- **Animación:** `AnimateIn` stagger 110ms, `direction: up`

### Feature Cards

- **3 cards iguales** en `grid-cols-1 lg:grid-cols-3`
- Cada card: icono 48×48px (`rounded-2xl`, fondo tint del color), título, descripción, lista de bullets con checkmark
- **Bullets:** check en círculo de 16×16, color según la card (teal, violeta, verde)
- **Hover:** `hover:shadow-lg` (transition ya incluida)
- **Colores por card:**
  - IA: teal `#1A5C7A` / bg `#E8F3F7`
  - Agenda: violeta `#7C3AED` / bg `#F3E8FF`
  - Analytics: verde `#059669` / bg `#D1FAE5`
- **Animación:** `AnimateIn` stagger 120ms

### ChatMockup (componente reutilizable)

Props: `header`, `headerBg`, `messages`, `inputBg`, `sendBg`, `label`, `sublabel`

- **Wrapper:** `max-w-[230px]`, border `5px solid gray-200`, `rounded-[2rem]`
- **Header:** color dinámico vía `headerBg`, avatar circular blanco 32×32, nombre + estado
- **Mensajes usuario:** fondo `sendBg`, `borderRadius: "16px 16px 4px 16px"`
- **Mensajes bot:** fondo blanco, `borderRadius: "16px 16px 16px 4px"`
- **Input bar:** fondo blanco, placeholder gris, botón envío circular `sendBg`
- **Float animation:** cada teléfono tiene `animate-float` con `animationDelay` diferente (+0s, +1.5s, +2.8s)
- **AnimateIn:** stagger 0ms / 120ms / 240ms entre los 3

### Métricas Strip

| Métrica | Valor | Color |
|---------|-------|-------|
| Conversaciones / mes | 342 | `--ink` |
| Leads convertidos | 68% | `--coral` |
| Citas generadas por IA | 127 | `--teal-mid` |
| Tiempo de respuesta | < 2 s | `#059669` |

- Valores renderizan con `AnimatedCounter` — cuenta desde 0 al entrar al viewport
- "< 2 s" no tiene dígitos iniciales parseables, se muestra estático con fade
- Grid: `grid-cols-2 sm:grid-cols-4` con `divide-x divide-y sm:divide-y-0`

### AgendaMockup

- Fondo `#0B2F42`, border radius 20px, `box-shadow: 0 32px 80px rgba(0,0,0,0.4)`
- Header estilo macOS (dots rojo/amarillo/verde)
- Grid: columna de horarios (52px) + 3 columnas de doctores
- Slots: cada 30 minutos (09:00–12:30), alternado con subtle separator
- **Colores por doctor:**
  - Dra. Aranda: verde `#10B981` / bg `#D1FAE5`
  - Dr. Engel: azul `#3B82F6` / bg `#DBEAFE`
  - Dra. Pérez: violeta `#8B5CF6` / bg `#EDE9FE`
- **Animación:** `AnimateIn direction="right"` + `animate-float-slow` en el wrapper

### Pricing Cards

- **Starter / Enterprise:** `border: 1px solid --border`, fondo `--surface-white`
- **Pro (destacada):** `border: 2px solid --coral`, badge "Más popular" absoluto `-top-3.5`
- Badge Pro: `absolute -top-3.5 left-1/2 -translate-x-1/2`, fondo `--coral`, texto blanco, `rounded-full`
- **Animación:** `AnimateIn` stagger 0ms / 110ms / 220ms

---

## Animaciones y Motion

### Definiciones CSS (`globals.css`)

```css
/* Fade up — solo en hero (on page load) */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
.animate-fade-up-delay-1 { animation-delay: 0.1s; }
.animate-fade-up-delay-2 { animation-delay: 0.2s; }
.animate-fade-up-delay-3 { animation-delay: 0.32s; }

/* Float — mockups */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
.animate-float      { animation: float 5s ease-in-out infinite; }
.animate-float-slow { animation: float 7s ease-in-out infinite; }
```

### AnimateIn (scroll-triggered)

**Archivo:** `components/AnimateIn.tsx` — client component

| Prop | Default | Descripción |
|------|---------|-------------|
| `direction` | `'up'` | Dirección: `up` / `left` / `right` / `none` |
| `delay` | `0` | Delay en ms antes de animar |
| `threshold` | `0.12` | % del elemento visible para trigger |

- **Translate inicial:** 22px en la dirección especificada
- **Easing:** `cubic-bezier(0.22,1,0.36,1)` (ease-out spring)
- **Duración:** 650ms
- **Trigger:** IntersectionObserver, se dispara una sola vez

### AnimatedCounter (scroll-triggered)

**Archivo:** `components/AnimatedCounter.tsx` — client component

- **Duración:** 1400ms
- **Easing:** ease-out cúbico `1 - (1-t)³`
- **Threshold:** 50% del elemento visible
- **Comportamiento:** Si el valor no tiene dígitos (e.g. "< 2 s"), se muestra estático
- **Trigger:** IntersectionObserver, se dispara una sola vez

### Tabla completa de animaciones

| Elemento | Trigger | Animación | Duración | Easing |
|----------|---------|-----------|----------|--------|
| Badge eyebrow hero | Page load | `fade-up` delay 0s | 550ms | spring |
| Hero h1 | Page load | `fade-up` delay 0.1s | 550ms | spring |
| Hero p / CTAs | Page load | `fade-up` delay 0.32s | 550ms | spring |
| HeroShowcase | Page load + loop | `fade-up` + `float-slow` | 550ms / 7s | spring / ease-in-out |
| Pilares (4 items) | Scroll | `AnimateIn up` stagger 90ms | 650ms | spring |
| Problem cards (3) | Scroll | `AnimateIn up` stagger 110ms | 650ms | spring |
| Feature cards (3) | Scroll | `AnimateIn up` stagger 120ms | 650ms | spring |
| Chat mockups (3) | Scroll + loop | `AnimateIn up` stagger 120ms + `float` desfasado | 650ms / 5s | spring / ease-in-out |
| Métricas valores | Scroll | `AnimatedCounter` | 1400ms | ease-out cubic |
| AgendaMockup | Scroll + loop | `AnimateIn right` + `float-slow` | 650ms / 7s | spring / ease-in-out |
| Pasos proceso (4) | Scroll | `AnimateIn up` stagger 100ms | 650ms | spring |
| Pricing cards (3) | Scroll | `AnimateIn up` stagger 110ms | 650ms | spring |
| Dots hero/badge | Loop | `animate-pulse` (Tailwind) | ~2s | — |

---

## Estados e Interacciones

| Elemento | Estado | Comportamiento |
|----------|--------|----------------|
| CTA "Prueba molari.ai gratis" | Default | fondo `--coral`, sombra coral |
| CTA "Prueba molari.ai gratis" | Hover | `opacity-90` + `scale-[1.02]` |
| CTA "Prueba molari.ai gratis" | Active | `scale-[0.98]` |
| Nav links | Hover | `transition-colors` (implementar hover color `--ink`) |
| "Ver demo" nav | Hover | `opacity-90` |
| Feature cards | Hover | `shadow-lg` (transition incluida) |
| Links secundarios | Default | `underline underline-offset-2` |
| Pricing CTA Starter/Enterprise | Hover | `transition-colors` (borde y texto) |
| Pricing CTA Pro | Hover | `opacity-90` |
| Footer links | Hover | `hover:text-gray-900 transition-colors` |

---

## Comportamiento Responsive

| Sección | Mobile (< 640px) | Desktop (≥ 640px) |
|---------|-----------------|-------------------|
| Nav | Logo + Acceder + Ver demo (sin links) | Logo + Funciones + Precios + Acceder + Ver demo |
| Hero | 1 columna, h1 `text-5xl`, HeroShowcase bajo el texto | 2 columnas, h1 `text-6xl` |
| Pilares | 2×2 grid | 4 columnas |
| Problemas | 1 columna | 3 columnas |
| Features | 1 columna | 3 columnas |
| Plataformas (teléfonos) | 1 columna | 3 columnas |
| Métricas | 2×2 con divide-y | 4 columnas, divide-x, sin divide-y |
| Agenda | 1 columna (mockup debajo) | 2 columnas (texto izquierda, mockup derecha) |
| Cómo funciona | 1 columna con border-left a partir de i>0 (rompe en mobile) | 4 columnas |
| Pricing | 1 columna | 3 columnas |
| Hero CTA | Ancho completo (`w-full sm:w-auto`) | Auto |

---

## Edge Cases

- **Texto largo en ChatMockup:** Los mensajes truncan por `max-w-[85%]` + `leading-relaxed`. Si el texto es muy largo el bubble crece verticalmente.
- **Nombre de doctor largo en AgendaMockup:** Usa `whitespace: "nowrap"` — puede overflow si el nombre es > ~14 chars. Considerar `overflow-hidden text-ellipsis` en producción.
- **AnimatedCounter con valor sin dígitos:** Maneja `"< 2 s"` correctamente mostrando el valor raw sin animar. Cualquier valor sin `/\d+/` se muestra estático.
- **Precio "Custom":** La tarjeta Enterprise muestra "Custom" sin unidad. No renderiza `AnimatedCounter`.
- **Badge "Más popular" en mobile:** Usa `left-1/2 -translate-x-1/2` — funciona en cualquier ancho de tarjeta.
- **`HeroShowcase` interno:** El componente `HeroShowcase` tiene su propia lógica (ver `components/HeroShowcase.tsx`). El wrapper agrega `animate-float-slow` — si HeroShowcase tiene su propia `transform`, puede interferir. Verificar en ambos estados.
- **IntersectionObserver en SSR:** `AnimateIn` y `AnimatedCounter` son `'use client'` — se hidratan en el cliente. En SSR el elemento aparece con `opacity: 0`, lo que puede causar un flash si JS tarda. Considerar `<noscript>` fallback o `will-change: opacity` para mejorar el CLS.

---

## Accesibilidad

| Elemento | Nota |
|----------|------|
| Logo | `alt="molari.ai"` — correcto |
| Numeración decorativa 01/02/03 | Aria-hidden recomendado: `aria-hidden="true"` en el `<p>` del número |
| Dots decorativos (macOS mockup) | Sin texto — OK (decorativo) |
| Contraste texto hero | `#0C1B26` sobre `#F7F5F1` — ratio ~14:1 ✅ |
| Contraste muted text | `#607281` sobre `#FDFCFB` — ratio ~4.6:1 ✅ (AA) |
| Contraste blanco sobre coral | Blanco sobre `#D95F45` — ratio ~3.8:1 ⚠️ (AA large only) — revisar tamaño mínimo 18px bold |
| Contraste teal-light bg | `#1A5C7A` sobre `#E8F3F7` — ratio ~5.2:1 ✅ |
| CTAs `<a>` sin `href` | Todos los CTAs tienen href — correcto |
| Focus visible | Tailwind no agrega `:focus-visible` por defecto — añadir `focus-visible:outline-2 focus-visible:outline-offset-2` a CTAs y nav links |
| AnimateIn wrapper div | Añade un `<div>` extra — puede afectar order de focus. No tiene `tabindex` — OK |
| Orden de lectura | El orden visual coincide con el orden DOM en todas las secciones |

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `app/page.tsx` | Landing page completa (server component) |
| `app/globals.css` | Design tokens, keyframes, utility classes |
| `components/HeroShowcase.tsx` | Showcase interactivo del hero |
| `components/AnimateIn.tsx` | Scroll-triggered fade/slide wrapper |
| `components/AnimatedCounter.tsx` | Contador animado con IntersectionObserver |
| `public/logo.svg` | Logo molari.ai |

---

## Notas de implementación

1. **`AnimateIn` en grillas con `items-stretch`:** Se necesita pasar `style={{ display: 'flex', flexDirection: 'column' }}` al wrapper y `flex-1` o `h-full` al hijo para que las tarjetas mantengan altura igual. Ver pricing cards.

2. **Float + AnimateIn juntos:** El float usa `transform: translateY()` en loop. El AnimateIn también usa `transform` para el slide inicial. En Safari puede haber conflicto si ambos corren al mismo tiempo. El AnimateIn limpia su `transform` con `el.style.transform = 'translate(0,0)'` antes de que el float tome el control — verificar en Safari.

3. **Stagger máximo recomendado:** Para listas de más de 5 items, reducir el delay por item a 60–80ms para que el último no tarde demasiado.

4. **`animate-pulse` de Tailwind:** Usado en los dots decorativos del hero. Es una animación CSS pura (`opacity` 1→0.5), no interfiere con ninguna otra.
