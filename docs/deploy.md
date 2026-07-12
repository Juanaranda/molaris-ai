# Guía de despliegue — molari.ai (producción + beta)

Cómo conectar toda la infraestructura: base de datos, backend, frontend, webhooks e integraciones.
Recomendado para 1 dev: **Vercel** (frontend) + **Railway** (backend + PostgreSQL). Render/Fly funcionan igual con los mismos pasos.

---

## 1. Arquitectura

```
Navegador / WhatsApp
        │
        ▼
Frontend (Next.js)  ──HTTPS──►  Backend (Fastify)  ──►  PostgreSQL
   Vercel                          Railway                Railway
```

- **Frontend (Next.js)** → Vercel. Deploy por rama: `main` = producción, `beta` = pruebas.
- **Backend (Fastify)** → Railway. Un servicio por ambiente (corre 24/7: scheduler de recordatorios + webhooks).
- **PostgreSQL** → Railway. Una base por ambiente. **Nunca se mezclan prod y beta.**

## 2. Dos ambientes (calza con el flujo git `dev → beta → main`)

| Ambiente | Rama git | Frontend | Backend | DB |
|---|---|---|---|---|
| **Beta** (pruebas) | `beta` | molari-beta.vercel.app | molari-api-beta (Railway) | DB beta |
| **Producción** | `main` | molari.ai (dominio) | molari-api (Railway) | DB prod |

Probás en beta con Galana → cuando funciona, PR `beta → main` y queda en producción.

---

## 3. Paso a paso

### A. Base de datos (Railway)
1. Crear cuenta en railway.app y un **proyecto** "molari-prod".
2. Dentro: **New → Database → PostgreSQL**. Railway crea la DB y te da una variable `DATABASE_URL`.
3. Repetir en un proyecto aparte "molari-beta" para la base de pruebas.
   - (Alternativa: Neon.tech, Postgres serverless con "branching" — una base con rama beta.)

### B. Backend (Railway)
1. En el proyecto prod: **New → GitHub Repo** → elegí el repo `molaris-ai`.
2. **Root directory:** `backend`
3. **Build command:** `npm install && npm run build`  *(genera Prisma client + compila)*
4. **Start command:** `npm run start:prod`  *(sincroniza la DB con `prisma db push` y arranca)*
5. **Branch:** `main` (en el proyecto beta, branch `beta`)
6. Variables de entorno → ver sección 4. La más importante: `DATABASE_URL` (referencia la del Postgres del mismo proyecto) y `OAUTH_REDIRECT_BASE` = la URL pública que Railway te asigna a este backend.
7. Deploy. Probá `https://<tu-backend>/health` → debe responder `{"status":"ok"}`.

### C. Frontend (Vercel)
1. Crear cuenta en vercel.com → **Add New → Project** → importá `molaris-ai`.
2. **Root directory:** `frontend`
3. Framework: Next.js (autodetectado). Build/Output por defecto.
4. **Production branch:** `main`. (Vercel crea deploys automáticos de la rama `beta` también.)
5. Variable de entorno `NEXT_PUBLIC_API_URL` = la URL del backend de ese ambiente:
   - Production → `https://molari-api...` (backend prod)
   - Preview (beta) → `https://molari-api-beta...` (backend beta)
6. Deploy.

### D. Conectar webhooks e integraciones (necesitan la URL pública del backend)
Ahora que el backend tiene URL pública, se activan:
- **WhatsApp (Meta):** webhook URL = `https://<backend>/api/webhooks/meta`, verify token = `META_VERIFY_TOKEN`, suscribir campo `messages`. (Issue #31)
- **Mercado Pago (OAuth):** redirect URI = `https://<backend>/api/integrations/mercadopago/oauth/callback`. Setear `MP_CLIENT_ID`/`MP_CLIENT_SECRET` + `OAUTH_REDIRECT_BASE` = `https://<backend>`. (Issue #48)

---

## 4. Variables de entorno

### Backend (Railway)

**Requeridas:**
| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Connection string de Postgres (referencia la DB del proyecto) |
| `JWT_SECRET` | String random largo (firma de tokens). Distinto en beta y prod |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | URL del frontend de ese ambiente (para links + CORS) |
| `OAUTH_REDIRECT_BASE` | URL pública de ESTE backend (para los callbacks OAuth) |

**IA (al menos una):**
| `GROQ_API_KEY` · `GROQ_MODEL` | proveedor principal |
| `OPENROUTER_API_KEY` · `OPENROUTER_MODEL_FAST/BALANCED/SMART/RESERVE` | fallback |
| `GEMINI_API_KEY` | opcional |

**Integraciones (cuando las actives):**
| `META_VERIFY_TOKEN` · `META_APP_SECRET` | WhatsApp Meta |
| `MP_CLIENT_ID` · `MP_CLIENT_SECRET` · `MP_NOTIFICATION_URL` | Mercado Pago OAuth |
| `ALERT_WA_PHONE_ID` · `ALERT_WA_TOKEN` · `ALERT_WA_TO` | alertas por WhatsApp al admin (kill switch, fallos) |
| `OPENFACTURA_BASE_URL` · `ZAPSIGN_BASE_URL` | boleta SII / firmas (tienen default) |

`PORT` lo setea Railway solo — no la toques.

### Frontend (Vercel)
| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend de ese ambiente (sin slash final) |

---

## 5. Checklist de orden
1. [ ] Crear DB prod + DB beta
2. [ ] Backend beta deployado, `/health` ok
3. [ ] Frontend beta deployado apuntando al backend beta
4. [ ] Probar e2e en beta con Galana (chat, agenda)
5. [ ] Repetir para prod (rama `main`)
6. [ ] Conectar webhook WhatsApp + OAuth MP (sección D) en cada ambiente
7. [ ] Dominio `molari.ai` → apuntar a Vercel (prod)

## 6. Notas
- **DB push, no migrate:** el deploy usa `prisma db push` (ver [[db-migration-workflow]]). Es aditivo y seguro.
- **CORS:** el backend permite el origen de `FRONTEND_URL`. Si el front no conecta, revisá que `FRONTEND_URL` sea exactamente el dominio del frontend.
- **Secretos:** nunca commitear `.env`. Cada secreto se setea en el panel de Railway/Vercel por ambiente.
- **Primer deploy:** `prisma db push` crea todas las tablas en la DB vacía automáticamente.
