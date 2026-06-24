/**
 * Audit log médico-legal — Ley 20.584 / 21.719.
 *
 * Toda lectura/edición de datos sensibles (fichas, eventos dentales,
 * imágenes, identidad, boletas) debe quedar trazada con:
 *   - quién (actorId del JWT)
 *   - cuándo (createdAt)
 *   - qué (resourceType + resourceId)
 *   - cómo (snapshot before/after sanitizados)
 *   - desde dónde (ip + userAgent)
 *
 * Fire-and-forget: no bloquea la response, errores quedan en log local.
 */

import type { FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";

export type AuditAction       = "read" | "create" | "update" | "delete";
export type AuditResourceType =
  | "ClinicalRecord"
  | "ClinicalNote"
  | "DentalEvent"
  | "ToothImage"
  | "Identity"
  | "Boleta"
  | "Payment";

interface AuditInput {
  req:            FastifyRequest;
  actorId:        string | null;        // userId del JWT del partner
  clinicId:       string;
  action:         AuditAction;
  resourceType:   AuditResourceType;
  resourceId:    string;
  snapshotBefore?: unknown;
  snapshotAfter?:  unknown;
}

/**
 * Campos NUNCA deben aparecer en snapshots (incluso si el caller no los filtra).
 * Defensa en profundidad.
 */
const FORBIDDEN_KEYS = new Set([
  "passwordHash", "password",
  "siiApiKey", "mpAccessToken", "waToken",
  "raw", "xmlContent", "url",  // url puede contener PDF/data URLs grandes
]);

function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v, depth + 1));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else if (typeof v === "string" && v.length > 500) {
        out[k] = v.slice(0, 500) + "…";
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  return obj;
}

export function audit(opts: AuditInput): void {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    clinicId:       opts.clinicId,
    actorId:        opts.actorId,
    action:         opts.action,
    resourceType:   opts.resourceType,
    resourceId:     opts.resourceId,
    snapshotBefore: opts.snapshotBefore !== undefined
      ? (sanitize(opts.snapshotBefore) as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    snapshotAfter:  opts.snapshotAfter !== undefined
      ? (sanitize(opts.snapshotAfter) as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    ip:             opts.req.ip ?? null,
    userAgent:      (opts.req.headers["user-agent"] as string | undefined) ?? null,
  };
  // Fire-and-forget: prisma.create devuelve una Promise; no esperamos.
  prisma.auditLog.create({ data }).catch((e) => {
    console.error("[Audit] insert failed:", e instanceof Error ? e.message : e);
  });
}
