import { config } from "../config/env";

// Dedupe en memoria para webhooks entrantes. Meta y Twilio entregan
// at-least-once: reintentan si no ven un 2xx a tiempo. Un evento repetido no
// debe re-procesarse ni generar otra respuesta de la IA (#53).
//
// Set con orden de inserción, acotado por namespace; se resetea al reiniciar
// —aceptable porque los reintentos ocurren en ventanas cortas—. Con varias
// instancias cada una tiene su propio Set, así que el dedup fuerte igual lo da
// el claim atómico en DB de cada acción; esto solo evita el trabajo/respuesta
// duplicada en el caso común (reintento a la misma instancia).

const MAX_ENTRIES = 5000;
const stores = new Map<string, Set<string>>();

// Lógica pura, sin depender del entorno — testeable directamente.
export function markSeen(namespace: string, id: string): boolean {
  if (!id) return false;
  let seen = stores.get(namespace);
  if (!seen) {
    seen = new Set<string>();
    stores.set(namespace, seen);
  }
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > MAX_ENTRIES) {
    for (const w of seen) {
      seen.delete(w);
      if (seen.size <= MAX_ENTRIES / 2) break;
    }
  }
  return false;
}

// Para uso en los webhooks: en tests se desactiva para no interferir con
// payloads que repiten ids a propósito.
export function isDuplicateWebhookEvent(namespace: string, id: string): boolean {
  if (config.nodeEnv === "test") return false;
  return markSeen(namespace, id);
}

// Solo para tests del propio dedup.
export function _resetWebhookDedup(): void {
  stores.clear();
}
