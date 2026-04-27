# molari.ai — Guía de setup en nuevo dispositivo

## Requisitos previos

- Node.js 20+
- PostgreSQL 15+ (local o cloud, ej: Railway, Supabase, Neon)
- Git

---

## 1. Clonar el repo

```bash
git clone https://github.com/Juanaranda/molari-ai.git
cd molari-ai
git checkout dev    # rama de desarrollo activa
```

---

## 2. Backend

### 2.1 Instalar dependencias

```bash
cd backend
npm install
```

### 2.2 Variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores reales:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT (cambia en producción) |
| `OPENROUTER_API_KEY` | API key de OpenRouter (LLM) |
| `PORT` | Puerto del backend (default: 3001) |

### 2.3 Aplicar migraciones y poblar la base de datos

```bash
# Aplica todas las migraciones (incluida la de partner_users)
npx prisma migrate deploy

# Genera el cliente Prisma
npx prisma generate

# Pobla la BD con clínica Galana y usuarios demo
npx prisma db seed
```

**Usuarios creados por el seed:**

| Email | Contraseña | Rol | Clínica |
|---|---|---|---|
| superadmin@molari.ai | molari2024! | SUPERADMIN | — |
| admin@galana.cl | galana2024! | ADMIN | Galana |
| recepcion@galana.cl | galana2024! | USER | Galana |

### 2.4 Iniciar el servidor

```bash
npm run dev        # desarrollo (hot-reload)
npm run build && npm start   # producción
```

El backend queda en `http://localhost:3001`.

---

## 3. Frontend

### 3.1 Instalar dependencias

```bash
cd ../frontend
npm install
```

### 3.2 Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3.3 Iniciar el servidor

```bash
npm run dev        # desarrollo → http://localhost:3000
npm run build && npm start   # producción
```

---

## 4. Estructura del proyecto

```
molari-ai/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelos: Clinic, PartnerUser, Patient, Session, ...
│   │   ├── seed.ts                # datos iniciales (Galana + usuarios demo)
│   │   └── migrations/            # migraciones SQL versionadas
│   └── src/
│       ├── config/
│       │   ├── env.ts             # variables de entorno tipadas
│       │   └── clinics/galana.ts  # config estática de Galana (horarios, doctores, servicios)
│       ├── routes/
│       │   ├── auth.ts            # POST /api/auth/login, GET /api/auth/me
│       │   ├── clinics.ts         # GET/PATCH/POST /api/clinics
│       │   ├── chat.ts            # POST /api/chat
│       │   ├── availability.ts    # GET /api/availability
│       │   └── bookings.ts        # POST /api/bookings
│       ├── controllers/
│       │   └── chatController.ts
│       └── services/
│           ├── ai/                # integración OpenRouter / LLM
│           └── availability/      # lógica de slots disponibles
└── frontend/
    ├── app/
    │   ├── page.tsx               # landing page (ventas)
    │   ├── login/page.tsx         # login de partners
    │   ├── register/page.tsx      # onboarding de nuevas clínicas (2 pasos)
    │   ├── partners/dashboard/    # panel de administración de la clínica
    │   ├── pricing/page.tsx
    │   └── widget/                # widget embebible
    ├── components/
    │   ├── ChatDemo.tsx           # chat demo (acepta clinicSlug prop)
    │   ├── DemoSection.tsx        # wrapper client que lee ?clinic= del URL
    │   ├── DoctorsEditor.tsx      # tabla editable de doctores
    │   ├── ServicesEditor.tsx     # tabla editable de servicios y precios
    │   └── AvailabilityPicker.tsx
    └── lib/
        ├── auth.ts                # login(), getMe(), logout(), updateClinic()
        └── dateParser.ts
```

---

## 5. API endpoints relevantes

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login, devuelve JWT |
| GET | `/api/auth/me` | Bearer | Usuario + clínica autenticados |
| POST | `/api/clinics` | — | Registro de nueva clínica + admin |
| GET | `/api/clinics/:id` | Bearer | Obtener datos de clínica |
| PATCH | `/api/clinics/:id` | Bearer (ADMIN+) | Editar datos de clínica |
| POST | `/api/chat` | — | Chat con el asistente |
| GET | `/api/availability` | — | Slots disponibles por semana |
| POST | `/api/bookings` | — | Confirmar reserva |

---

## 6. Flujo de uso (partner)

1. **Registro**: `/register` → datos de clínica + cuenta admin → redirige al dashboard
2. **Login**: `/login` → dashboard
3. **Dashboard** `/partners/dashboard`:
   - Ver y editar info básica (nombre, teléfono, redes, ubicación)
   - Ver y editar doctores (agregar, editar, eliminar)
   - Ver y editar servicios y precios
   - Botón "Abrir demo" → `/?clinic=<slug>#demo`
4. **Demo personalizado**: la landing page detecta `?clinic=<slug>` y usa ese contexto en el chat

---

## 7. Roles de usuarios

| Rol | Puede ver | Puede editar |
|---|---|---|
| `USER` | Su clínica | — |
| `ADMIN` | Su clínica | Info básica, doctores, servicios de su clínica |
| `SUPERADMIN` | Todas las clínicas | Todo |

---

## 8. Pendiente para siguientes iteraciones

- [ ] Edición de horarios desde el dashboard (hoy solo lectura)
- [ ] Configuración del tono del asistente desde el dashboard
- [ ] Integración Dentalink API (agendamiento real)
- [ ] Integración Reservo API
- [ ] Dashboard de leads y conversaciones por clínica
- [ ] Disponibilidad dinámica cargada desde DB (hoy usa config estática de `galana.ts`)
- [ ] Formulario de pricing page que derive al registro
- [ ] Notificaciones por WhatsApp al agendar (Twilio configurado, falta activar)
