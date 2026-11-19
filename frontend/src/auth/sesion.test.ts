import { describe, expect, it } from "vitest";
import { horarioDe, meDe } from "../test/fabricas";
import {
  MS_AVISO_SESION,
  faseSesion,
  motivoDeVencimiento,
  msHastaVencimiento,
  textoAvisoSesion,
  textoSesionHasta,
  textosFin,
} from "./sesion";

const ZONA = "America/Argentina/Buenos_Aires";
const horario = horarioDe("2026-11-17T10:00:00-03:00");

describe("faseSesion", () => {
  it("300 001 ms es vigente, 300 000 por vencer y 0 vencida", () => {
    expect(MS_AVISO_SESION).toBe(300_000);
    expect(faseSesion(300_001)).toBe("vigente");
    expect(faseSesion(300_000)).toBe("por-vencer");
    expect(faseSesion(1)).toBe("por-vencer");
    expect(faseSesion(0)).toBe("vencida");
    expect(faseSesion(-5)).toBe("vencida");
  });
});

describe("msHastaVencimiento", () => {
  const me = meDe("operador", { sesion_expira: "2026-11-17T10:00:00-03:00", segundos_restantes: 600 });
  const ahoraServidor = Date.UTC(2026, 10, 17, 12, 55);

  it("con la hora del servidor mide contra sesion_expira", () => {
    expect(msHastaVencimiento(me, ahoraServidor, 1000, 99999)).toBe(5 * 60_000);
  });

  it("sin hora del servidor usa segundos_restantes desde la marca de la respuesta", () => {
    expect(msHastaVencimiento(me, null, 1000, 1000)).toBe(600_000);
    expect(msHastaVencimiento(me, null, 1000, 61_000)).toBe(540_000);
  });

  it("pasado el vencimiento da un valor negativo", () => {
    expect(msHastaVencimiento(me, Date.UTC(2026, 10, 17, 13, 1), 0, 0)).toBeLessThan(0);
  });
});

describe("textoAvisoSesion y textoSesionHasta", () => {
  it("dicen la hora del vencimiento en la zona del servidor", () => {
    expect(textoAvisoSesion("2026-11-17T10:00:00-03:00", ZONA)).toBe("Tu sesión vence a las 10:00.");
    expect(textoSesionHasta("2026-11-17T10:00:00-03:00", ZONA)).toBe("Sesión hasta las 10:00");
    expect(textoSesionHasta("2026-11-17T13:00:00Z", ZONA)).toBe("Sesión hasta las 10:00");
  });
});

describe("motivoDeVencimiento", () => {
  it("vencer a las 18:00 cae fuera de la franja: jornada", () => {
    expect(motivoDeVencimiento("2026-11-17T18:00:00-03:00", horario)).toBe("jornada");
  });

  it("vencer a las 10:00 cae dentro de la franja: duración", () => {
    expect(motivoDeVencimiento("2026-11-17T10:00:00-03:00", horario)).toBe("duracion");
  });

  it("sin franja es duración", () => {
    expect(motivoDeVencimiento("2026-11-17T18:00:00-03:00", null)).toBe("duracion");
  });
});

describe("textosFin", () => {
  it("por el fin de la franja", () => {
    expect(textosFin("jornada", horario)).toEqual({
      titulo: "La jornada terminó",
      descripcion: "El acceso está disponible de lunes a viernes, de 08:00 a 18:00. Tu sesión se cerró.",
      motivoSalida: "La jornada terminó.",
    });
  });

  it("por la duración de la sesión", () => {
    expect(textosFin("duracion", horario)).toEqual({
      titulo: "Tu sesión venció",
      descripcion: "Iniciá sesión de nuevo para seguir.",
      motivoSalida: "Tu sesión venció.",
    });
  });

  it("jornada sin franja da los textos de la duración", () => {
    expect(textosFin("jornada", null)).toEqual(textosFin("duracion", horario));
  });
});
