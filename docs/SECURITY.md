# Seguridad — molari.ai

Fecha: 2026-05-10 | Revisión: v1.0

---

## Protección de datos de pacientes y clínicas

### 1. Autenticación

| Mecanismo | Detalle |
|---|---|
| Contraseñas | bcrypt con 12 rondas (factor 2^12 iteraciones) |
| Tokens de sesión (partner) | JWT firmado con `JWT_SECRET` (mínimo 32 chars, falla en startup si ausente), expira en 7 días |
| Tokens de sesión (paciente) | JWT separado (`PATIENT_JWT_SECRET`), expira en 7 días |
| Arranque del servidor | Falla inmediatamente si `JWT_SECRET` no está configurado o es demasiado corto — no hay fallback hardcodeado |

**Dato sensible**: Las contraseñas nunca se almacenan en texto plano ni se loguean. Solo el hash bcrypt se guarda en la base de datos.

---

### 2. Autorización y aislamiento multi-tenant

Cada clínica tiene un `clinicId` único. El `clinicId` se incluye en el payload del JWT al momento del login y se verifica en **cada ruta del backend** antes de ejecutar cualquier query. Un usuario de la Clínica A no puede acceder a datos de la Clínica B.

Reglas implementadas:
- Todas las queries a `prisma.booking`, `prisma.session`, `prisma.patientContext`, `prisma.dentalQuote`, `prisma.treatmentPlan` filtran por `clinicId: payload.clinicId`
- Los endpoints de modificación (PATCH/DELETE) verifican que el recurso pertenece a la clínica antes de modificarlo
- La función `assertSuperAdmin` en rutas administrativas verifica el rol directamente y retorna `null` (deteniendo la ejecución) si el usuario no es SUPERADMIN — ningún admin de clínica puede acceder a datos de otras clínicas
- El `sessionId` del chatbot se verifica que pertenezca a la clínica del slug antes de reutilizarlo

---

### 3. Headers de seguridad HTTP

Se usa `@fastify/helmet` en todas las respuestas:

- `X-Content-Type-Options: nosniff` — previene MIME-sniffing
- `X-Frame-Options: SAMEORIGIN` — previene clickjacking
- `X-DNS-Prefetch-Control: off`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security` — fuerza HTTPS en producción

---

### 4. CORS

En **producción** solo se aceptan requests desde:
- `FRONTEND_URL` (configurado en variables de entorno)
- Subdominios de `*.molari.ai`

En desarrollo se acepta cualquier origen para facilitar el trabajo local.

---

### 5. Rate limiting

`@fastify/rate-limit` activo en todos los endpoints:

| Tier | Límite |
|---|---|
| Global | 120 requests/minuto por IP o token |

Las rutas de autenticación reciben el mismo límite global. Si una IP o token supera el límite recibe un `429` con mensaje en español.

---

### 6. Webhook Twilio (WhatsApp)

El endpoint `POST /api/webhooks/whatsapp/:slug` valida la firma `X-Twilio-Signature` usando `twilio.validateRequest()` con el `TWILIO_AUTH_TOKEN`. Si la firma es inválida o está ausente, se responde `403 Forbidden` sin procesar el mensaje.

Esto previene:
- Requests forjados que simulan mensajes de pacientes
- Abuso de recursos (cada mensaje llama a la IA con costo en USD)
- Contaminación de datos de sesiones y leads

---

### 7. Datos sensibles en respuestas de API

- **Login**: solo se devuelven los campos necesarios de la clínica (`id`, `slug`, `name`, `plan`, `active`, canales de contacto, `config`). No se exponen campos internos del ORM.
- **RUT chileno**: se almacena y devuelve solo cuando se solicita explícitamente con token válido. No aparece en logs.
- **Teléfonos y emails**: solo accesibles desde endpoints autenticados con `clinicId` verificado.
- **Contraseñas**: nunca devueltas en ningún endpoint. El campo `passwordHash` nunca aparece en ningún `select` de respuesta.

---

### 8. Logs y observabilidad

En producción, el logger de Fastify está configurado en nivel `warn` y solo registra `método + URL` de cada request — sin body, sin headers de autorización, sin datos de pacientes. En desarrollo se usa nivel `info` para facilitar debugging.

Los errores de la IA (timeouts, fallos de modelo) se loguean con nivel `error` sin incluir el contenido del mensaje del paciente.

---

### 9. Secretos y variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | ✅ Sí (≥32 chars) | Firma de tokens partner. El servidor no arranca sin ella. |
| `DATABASE_URL` | ✅ Sí | Conexión a PostgreSQL |
| `TWILIO_AUTH_TOKEN` | Recomendada | Validación de webhooks WhatsApp |
| `GEMINI_API_KEY` | Opcional | Generación de imágenes dentales |
| `OPENROUTER_API_KEY` | Recomendada | IA del chatbot |
| `FRONTEND_URL` | Recomendada | CORS en producción |

El `.gitignore` excluye `.env` y todas sus variantes (`.env.*`, `.env.production`, `.env.staging`, etc.). El archivo `.env.example` con valores de ejemplo sí se trackea para documentar la configuración.

**Regla**: ningún secreto debe aparecer en código fuente. El servidor falla explícitamente en startup si falta `JWT_SECRET`.

---

### 10. Base de datos

- Se usa **Prisma ORM** con queries parametrizadas — no hay SQL dinámico construido con concatenación de strings (inmune a SQL injection)
- Las queries raw con `$queryRaw` usan template literals de Prisma que también parametrizan los valores
- La conexión a PostgreSQL usa SSL en producción (Railway lo configura automáticamente)
- Backups: responsabilidad del proveedor de infraestructura (Railway)

---

### 11. Frontend

- Los tokens JWT se almacenan en `localStorage`. Esto los expone a XSS si hubiera una vulnerabilidad en dependencias de npm. Mitigación: el frontend no tiene vectores XSS conocidos y las dependencias se auditan con `npm audit`.
- No se almacenan datos sensibles de pacientes en `localStorage` ni en cookies.
- El frontend usa Next.js 15 con headers de seguridad configurados por defecto.

**Roadmap**: migrar tokens a cookies `HttpOnly; Secure; SameSite=Strict` para eliminar completamente el riesgo XSS.

---

### 12. Inputs del chatbot

- Todos los mensajes pasan por `checkTopic()` que detecta y bloquea intentos de jailbreak, mensajes off-topic, y contenido excesivamente largo antes de llamar a la IA
- El prompt del sistema incluye instrucciones explícitas para que el modelo ignore intentos de manipulación
- El `sessionId` enviado por el cliente se verifica que pertenezca a la clínica correspondiente antes de reutilizarlo

---

## Cumplimiento y estándares

| Estándar | Estado |
|---|---|
| OWASP Top 10 — Broken Access Control | ✅ Mitigado (multi-tenant estricto, `assertSuperAdmin`) |
| OWASP Top 10 — Cryptographic Failures | ✅ Mitigado (bcrypt/12, JWT con secret fuerte, HTTPS via proxy) |
| OWASP Top 10 — Injection | ✅ Mitigado (Prisma ORM, queries parametrizadas) |
| OWASP Top 10 — Security Misconfiguration | ✅ Mitigado (helmet, CORS restringido en prod, startup fail-fast) |
| OWASP Top 10 — Vulnerable Components | ⚠ Parcial (npm audit activo, 8 vulnerabilidades en dependencias indirectas pendientes de fix upstream) |
| OWASP Top 10 — Security Logging | ✅ Mitigado (logs sin datos sensibles en producción) |
| Ley 19.628 Chile (datos personales) | ✅ Parcial (datos accesibles solo por clínica propietaria, sin venta a terceros, sin exposición cross-tenant) |

---

## Contacto de seguridad

Para reportar vulnerabilidades: juanaranda.app@gmail.com

Incluir en el reporte: descripción del problema, pasos para reproducir, impacto estimado.
