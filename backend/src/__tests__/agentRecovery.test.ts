import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Auto-recuperación del agente (#58).
 *
 * Lo que se blinda acá es la regla que separa una función útil de un bug
 * grave: el sistema solo puede deshacer SUS PROPIAS pausas. Si reactivara un
 * agente que el dueño apagó a mano, lo pondría a hablar con pacientes en
 * contra de una decisión explícita — y sin que nadie se entere.
 */

const { mockPrisma, mockTriggerAlert, mockProbe } = vi.hoisted(() => ({
  mockPrisma: {
    clinic: { findMany: vi.fn(), updateMany: vi.fn() },
  },
  mockTriggerAlert: vi.fn().mockResolvedValue(undefined),
  mockProbe: vi.fn(),
}));

vi.mock("../config/prisma", () => ({ default: mockPrisma }));
vi.mock("../services/alerts/alertService", () => ({ triggerAlert: mockTriggerAlert }));
vi.mock("../services/notifications/schedulerHealth", () => ({
  registerScheduler: vi.fn(),
  markSchedulerRun: vi.fn(),
}));

const { runRecoveryCheck } = await import("../services/agent/agentRecovery");

describe("auto-recuperación del agente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.clinic.updateMany.mockResolvedValue({ count: 1 });
  });

  it("solo busca agentes con pausa AUTOMÁTICA — nunca los apagados a mano", async () => {
    mockPrisma.clinic.findMany.mockResolvedValue([]);
    await runRecoveryCheck(mockProbe);

    const where = mockPrisma.clinic.findMany.mock.calls[0][0].where;
    expect(where.agentDisabledBy).toBe("auto");
    expect(where.agentEnabled).toBe(false);
  });

  it("el update vuelve a exigir 'auto' — protege contra un apagado manual entremedio", async () => {
    mockPrisma.clinic.findMany.mockResolvedValue([{ id: "c1", name: "Clínica Uno" }]);
    mockProbe.mockResolvedValue(true);

    await runRecoveryCheck(mockProbe);

    const call = mockPrisma.clinic.updateMany.mock.calls[0]?.[0];
    // Si el update no reconfirma agentDisabledBy, una carrera reactivaría un
    // agente apagado a propósito entre el findMany y el update.
    expect(call.where.agentDisabledBy).toBe("auto");
    expect(call.where.agentEnabled).toBe(false);
    expect(call.data.agentEnabled).toBe(true);
    expect(call.data.agentDisabledBy).toBeNull();
  });

  it("no reactiva nada si el proveedor sigue caído", async () => {
    mockPrisma.clinic.findMany.mockResolvedValue([{ id: "c1", name: "Clínica Uno" }]);
    mockProbe.mockResolvedValue(false);

    const res = await runRecoveryCheck(mockProbe);

    expect(res).toEqual({ candidates: 1, recovered: 0 });
    expect(mockPrisma.clinic.updateMany).not.toHaveBeenCalled();
  });

  it("sin candidatos no consulta al proveedor (no gasta llamadas)", async () => {
    mockPrisma.clinic.findMany.mockResolvedValue([]);
    const res = await runRecoveryCheck(mockProbe);

    expect(res).toEqual({ candidates: 0, recovered: 0 });
    expect(mockProbe).not.toHaveBeenCalled();
  });
});
