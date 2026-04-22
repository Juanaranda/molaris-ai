import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { verifyToken } from "./auth";

export async function clinicRoutes(app: FastifyInstance) {
  // GET /api/clinics/:id
  app.get<{ Params: { id: string } }>("/clinics/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    // SUPERADMIN puede ver cualquier clínica; el resto solo la suya
    if (payload.role !== "SUPERADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id } });
    if (!clinic) return reply.status(404).send({ error: "Clínica no encontrada" });

    return reply.send(clinic);
  });

  // PATCH /api/clinics/:id  — solo ADMIN o SUPERADMIN
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      phone?: string;
      whatsapp?: string;
      instagram?: string;
      location?: string;
      config?: Record<string, unknown>;
    };
  }>("/clinics/:id", async (req, reply) => {
    let payload;
    try {
      payload = verifyToken(req.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "No autorizado" });
    }

    if (payload.role === "USER") {
      return reply.status(403).send({ error: "Sin permisos para editar" });
    }

    if (payload.role === "ADMIN" && payload.clinicId !== req.params.id) {
      return reply.status(403).send({ error: "Acceso denegado" });
    }

    const { name, phone, whatsapp, instagram, location, config } = req.body ?? {};

    const updated = await prisma.clinic.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(instagram !== undefined && { instagram }),
        ...(location !== undefined && { location }),
        ...(config !== undefined && { config: config as Prisma.InputJsonValue }),
      },
    });

    return reply.send(updated);
  });

  // POST /api/clinics — registro público de nueva clínica + admin
  app.post<{
    Body: {
      clinic: { name: string; phone?: string; location?: string; instagram?: string; whatsapp?: string };
      admin: { name: string; email: string; password: string };
    };
  }>("/clinics", async (req, reply) => {
    const { clinic: clinicData, admin } = req.body ?? {};
    if (!clinicData?.name || !admin?.email || !admin?.password || !admin?.name) {
      return reply.status(400).send({ error: "Nombre de clínica, nombre, email y contraseña son requeridos" });
    }
    if (admin.password.length < 8) {
      return reply.status(400).send({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const existing = await prisma.partnerUser.findUnique({ where: { email: admin.email.toLowerCase().trim() } });
    if (existing) {
      return reply.status(409).send({ error: "Ya existe una cuenta con ese email" });
    }

    // Generar slug desde el nombre
    const baseSlug = clinicData.name
      .toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    // Asegurar unicidad del slug
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.clinic.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    const newClinic = await prisma.clinic.create({
      data: {
        slug,
        name: clinicData.name,
        phone: clinicData.phone ?? null,
        location: clinicData.location ?? null,
        instagram: clinicData.instagram ?? null,
        whatsapp: clinicData.whatsapp ?? null,
        plan: "starter",
        config: {
          tone: "profesional pero cercano",
          schedule: { weekdays: "Lunes a Viernes: 09:00 - 18:00", saturday: "Sábado: cerrado", sunday: "Domingo: cerrado" },
          doctors: [],
          services: [],
          boxes: 1,
        },
        partnerUsers: {
          create: {
            name: admin.name,
            email: admin.email.toLowerCase().trim(),
            passwordHash,
            role: "ADMIN",
          },
        },
      },
    });

    return reply.status(201).send({ clinicId: newClinic.id, slug: newClinic.slug, message: "Clínica registrada correctamente" });
  });
}
