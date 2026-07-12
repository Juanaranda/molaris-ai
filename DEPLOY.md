# Guía de Deployment — molaris.ai

## Stack
- Frontend: Vercel (Next.js)
- Backend: Railway (Fastify + Node.js)
- Base de datos: Railway PostgreSQL

## Paso 1: Railway (Backend + DB)

1. Ir a [railway.app](https://railway.app) → New Project
2. Add → Database → PostgreSQL
3. Add → GitHub Repo → selecciona `molaris-ai/backend`
4. En Variables, agregar todas las vars de `backend/.env.example`:
   - `DATABASE_URL` → se autocompleta desde el PostgreSQL del paso 2
   - `JWT_SECRET` → genera con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - `OPENROUTER_API_KEY` → tu key de openrouter.ai
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
   - `FRONTEND_URL` → la URL de Vercel (paso 3)
   - `NODE_ENV=production`
5. Railway hace el deploy automático. La URL pública queda en Settings → Domains.

## Paso 2: Vercel (Frontend)

1. Ir a [vercel.com](https://vercel.com) → New Project
2. Importar el repo → selecciona la carpeta `frontend/` como Root Directory
3. En Environment Variables agregar:
   - `NEXT_PUBLIC_API_URL` = URL pública de Railway (ej: `https://molaris-backend.railway.app`)
4. Deploy → en ~2 minutos tienes la app online

## Paso 3: GitHub Actions (CI/CD automático)

En GitHub → Settings → Secrets → Actions, agregar:
- `RAILWAY_TOKEN` → railway.app → Account Settings → Tokens
- `VERCEL_TOKEN` → vercel.com → Settings → Tokens
- `VERCEL_ORG_ID` → vercel.com → Settings → General → Team ID
- `VERCEL_PROJECT_ID` → vercel.com → tu proyecto → Settings → General

Desde ahí, cada push a `main` hace deploy automático.

## Paso 4: WhatsApp con número real de Galana

1. Twilio Console → Messaging → Senders → WhatsApp Senders
2. Agregar el número de Galana → Twilio inicia verificación con Meta
3. Meta manda código al número de la clínica (~24-48h de aprobación)
4. Una vez aprobado, configurar webhook:
   ```
   https://tu-backend.railway.app/api/webhooks/whatsapp/galana
   ```
5. Listo — pacientes que escriban al WhatsApp de Galana reciben respuesta del agente

## Variables de entorno requeridas

| Variable | Descripción | Dónde obtener |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway (auto) |
| `JWT_SECRET` | Secret para tokens JWT | Generar aleatoriamente |
| `OPENROUTER_API_KEY` | Clave de IA | openrouter.ai/keys |
| `TWILIO_ACCOUNT_SID` | ID de cuenta Twilio | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Token de Twilio | console.twilio.com |
| `TWILIO_WHATSAPP_FROM` | Número WhatsApp Twilio | Sandbox: `whatsapp:+14155238886` |
| `FRONTEND_URL` | URL del frontend | URL de Vercel |
| `NODE_ENV` | Entorno | `production` |
