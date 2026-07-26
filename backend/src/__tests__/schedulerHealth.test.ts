import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  registerScheduler,
  markSchedulerRun,
  getSchedulerHealth,
} from "../services/notifications/schedulerHealth";

// El módulo mantiene estado global entre tests; usamos nombres únicos por test
// para no pisarnos, y timers falsos para controlar el paso del tiempo.
describe("schedulerHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un scheduler recién registrado y sin correr se reporta ok (pendiente)", () => {
    registerScheduler("t-fresh", 60_000);
    const rep = getSchedulerHealth().find((s) => s.name === "t-fresh")!;
    expect(rep.ok).toBe(true);
    expect(rep.lastRunAt).toBeNull();
    expect(rep.ageSec).toBeNull();
  });

  it("recién corrido queda ok con ageSec ~0", () => {
    registerScheduler("t-run", 60_000);
    markSchedulerRun("t-run");
    const rep = getSchedulerHealth().find((s) => s.name === "t-run")!;
    expect(rep.ok).toBe(true);
    expect(rep.ageSec).toBe(0);
    expect(rep.lastRunAt).toBe("2026-07-22T00:00:00.000Z");
  });

  it("dentro de 2× el intervalo sigue ok; pasado ese margen queda no-ok", () => {
    registerScheduler("t-stale", 60_000); // stale tras 120s
    markSchedulerRun("t-stale");

    vi.advanceTimersByTime(119_000); // justo antes del límite
    expect(getSchedulerHealth().find((s) => s.name === "t-stale")!.ok).toBe(true);

    vi.advanceTimersByTime(2_000); // ya pasó 121s > 120s
    const rep = getSchedulerHealth().find((s) => s.name === "t-stale")!;
    expect(rep.ok).toBe(false);
    expect(rep.ageSec).toBe(121);
  });

  it("volver a marcar resetea la antigüedad y lo devuelve a ok", () => {
    registerScheduler("t-reset", 60_000);
    markSchedulerRun("t-reset");
    vi.advanceTimersByTime(300_000); // muy atrasado
    expect(getSchedulerHealth().find((s) => s.name === "t-reset")!.ok).toBe(false);

    markSchedulerRun("t-reset"); // vuelve a disparar
    expect(getSchedulerHealth().find((s) => s.name === "t-reset")!.ok).toBe(true);
  });
});
