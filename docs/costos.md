# Costos de molari.ai — puesta en marcha y por clínica

> ⚠️ **Cifras aproximadas y orientativas** (no es asesoría legal ni contable). Los precios de proveedores, planes y aranceles cambian — usar como referencia para dimensionar, no como presupuesto cerrado.
> Referencias: US$1 ≈ CLP $950 · 1 UTM ≈ CLP $68.000 (mediados 2026).

---

## Resumen ejecutivo

| Concepto | Monto aprox |
|---|---|
| **Puesta en marcha** (una vez, camino lean) | **CLP $400.000 – $800.000** (~US$420–840) |
| **Costo fijo mensual** (base, 0–pocas clínicas) | **CLP $70.000 – $180.000/mes** (dominado por el contador) |
| **Costo variable por clínica nueva** | **CLP $5.000 – $15.000/mes** (~US$5–16) |
| **Margen bruto por clínica** (plan Profesional $99.990) | **~85–95%** |

**Conclusión:** el negocio es de **margen alto** (SaaS). El primer cliente pagando ya cubre el hosting + buena parte de lo fijo. Cada clínica nueva cuesta centavos comparada con lo que paga.

---

## 1. Puesta en marcha (una sola vez)

### Camino lean (recomendado para arrancar)
| Ítem | Costo aprox | Cuándo |
|---|---|---|
| Constituir empresa (SpA) vía *Empresa en un Día* | CLP $0 – $80.000 | Antes del 1er cliente pagado |
| Revisión legal del DPA + Política de Privacidad (manejas datos de salud → no improvisar) | CLP $200.000 – $400.000 | Antes del 1er cliente pagado |
| Dominio `molari.ai` (.ai es caro, 1 año) | ~CLP $67.000 – $95.000 (US$70–100) | Ya |
| Setup de hosting / deploy | CLP $0 (tu tiempo) | Ya |
| **Subtotal mínimo para operar** | **CLP $270.000 – $575.000** | |
| Registro de marca en INAPI (1 clase) — diferible | CLP $150.000 – $250.000 | Cuando haya tracción |

### Camino con abogado/firma (a medida)
- Constitución + pack legal completo a medida + marca con agente: **CLP $1.5M – $3M** (~US$1.600–3.200).
- Tiene sentido más adelante; para el piloto y los primeros clientes el camino lean alcanza.

> 💡 El piloto con Galana puede correr con un **acuerdo simple** (~CLP $0). El gasto legal real recién es necesario al cobrarle a una clínica que no sea de la familia.

---

## 2. Costos fijos mensuales (no dependen de cuántas clínicas tengas)

| Ítem | Costo aprox/mes |
|---|---|
| Hosting prod + beta (Vercel + Railway + Postgres) | CLP $10.000 – $15.000 (US$10–15) |
| Dominio `.ai` (amortizado) | ~CLP $7.000 |
| Contador (boletas/SII e impuestos) | CLP $50.000 – $150.000 |
| **Total fijo** | **~CLP $70.000 – $180.000/mes** |

El contador es el grueso. Al inicio se puede minimizar (SII gratis + contador por horas) hasta tener volumen.

---

## 3. Costo por clínica nueva (variable — escala con el uso)

Lo que cuesta de verdad sumar una clínica al sistema:

| Ítem | Costo aprox/mes por clínica | Nota |
|---|---|---|
| IA (Groq / OpenRouter) | CLP $1.000 – $5.000 (US$1–5) | Por conversación; centavos c/u |
| WhatsApp (Meta Cloud API) | CLP $0 – $10.000 | Meta cobra por conversación; hay tramo gratis mensual |
| Boleta electrónica (OpenFactura/Haulmer) | CLP $0 – $8.000 | Según plan/volumen de boletas |
| Cómputo/DB incremental | ~CLP $0 – $1.000 | Multi-tenant: comparten servidor |
| **Total variable por clínica** | **~CLP $5.000 – $15.000/mes** | |

**No es costo tuyo** (lo paga la clínica o el paciente):
- Comisión de Mercado Pago por pago online: ~2,9–3,5% de cada transacción.

---

## 4. Margen por clínica (unit economics)

| | Esencial | Profesional ⭐ |
|---|---|---|
| Precio al cliente | CLP $59.990/mes | CLP $99.990/mes |
| Costo variable (estimado) | ~CLP $8.000 | ~CLP $12.000 |
| **Margen bruto** | **~CLP $52.000 (87%)** | **~CLP $88.000 (88%)** |

Cada clínica deja casi todo lo que paga como margen — típico de SaaS bien hecho.

---

## 5. Escenarios (plan Profesional, números redondos)

| Clínicas | Ingreso/mes | Costo fijo | Costo variable | **Resultado/mes** |
|---|---|---|---|---|
| 1 (piloto, quizás gratis) | ~CLP $0–100k | $150k | $12k | **inversión** (etapa cero) |
| 5 | ~CLP $500k | $150k | $60k | **~+CLP $290k** |
| 20 | ~CLP $2.000k | $180k | $240k | **~+CLP $1.580k** |
| 50 | ~CLP $5.000k | $250k | $600k | **~+CLP $4.150k** |

(El costo fijo sube poco al crecer; la IA/WhatsApp escalan con el uso pero siguen siendo chicos vs el precio.)

---

## 6. Notas
- Estos números **excluyen tu sueldo/tiempo** y marketing (publicidad, si la haces).
- El punto de equilibrio se alcanza muy temprano: **~2–3 clínicas pagando** cubren todo lo fijo + el setup amortizado del primer año.
- Revisar precios reales al contratar: Vercel, Railway, OpenFactura, y aranceles INAPI/UTM cambian.
- Relacionado: [deploy.md](deploy.md) (infra) · decisiones de marca/pricing y compliance en las notas internas del proyecto.
