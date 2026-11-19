import { describe, expect, it, vi } from "vitest";
import { relojFalso } from "../test/tiempo";
import { horaDelServidor, medirDesfase } from "./relojServidor";

describe("relojServidor", () => {
  it("mide el desfase contra el punto medio del pedido", () => {
    expect(medirDesfase(10_000, 1_000, 1_400)).toBe(10_000 - 1_200);
  });

  it("la hora avanza con la marca del reloj monotónico", () => {
    const reloj = relojFalso(5_000);
    const desfase = medirDesfase(1_000_000, 5_000, 5_200);
    expect(horaDelServidor(desfase, reloj.ahora())).toBe(1_000_000 - 100);
    reloj.mover(30_000);
    expect(horaDelServidor(desfase, reloj.ahora())).toBe(1_000_000 - 100 + 30_000);
  });

  it("no depende de Date: mover el reloj del dispositivo no la cambia", () => {
    const desfase = medirDesfase(2_000_000, 100, 300);
    const antes = horaDelServidor(desfase, 1_000);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    expect(horaDelServidor(desfase, 1_000)).toBe(antes);
  });

  it("tolera un desfase negativo", () => {
    const desfase = medirDesfase(1_000, 50_000, 50_000);
    expect(desfase).toBe(-49_000);
    expect(horaDelServidor(desfase, 60_000)).toBe(11_000);
  });
});
