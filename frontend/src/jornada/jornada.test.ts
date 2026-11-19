import { describe, expect, it } from "vitest";
import { horarioDe } from "../test/fabricas";
import {
  MINUTOS_POR_CERRAR,
  calcularJornada,
  textoCompacto,
  textoEstado,
  textoFranja,
  textoFranjaEnFrase,
  textoProximaApertura,
  textoRestante,
} from "./jornada";

// Instante en Buenos Aires (UTC-3) de un día de noviembre de 2026.
const enBA = (dia: number, h: number, m = 0, s = 0, ms = 0) => Date.UTC(2026, 10, dia, h + 3, m, s, ms);
const MARTES = 17;
const horario = horarioDe("2026-11-17T10:00:00-03:00");

describe("calcularJornada", () => {
  it("08:00:00 está abierta", () => {
    const j = calcularJornada(horario, enBA(MARTES, 8));
    expect(j.estado).toBe("abierta");
    expect(j.diaHabil).toBe(true);
    expect(j.minutosRestantes).toBe(600);
    expect(j.reloj).toBe("08:00");
    expect(j.hoy).toBe("2026-11-17");
    expect(j.segundosDelDia).toBe(8 * 3600);
    expect(j.minutoDelDia).toBe(480);
  });

  it("17:44:59 sigue abierta", () => {
    const j = calcularJornada(horario, enBA(MARTES, 17, 44, 59));
    expect(j.estado).toBe("abierta");
    expect(j.minutosRestantes).toBe(16);
  });

  it("17:45:00 pasa a por cerrar con 15 minutos", () => {
    const j = calcularJornada(horario, enBA(MARTES, 17, 45));
    expect(j.estado).toBe("por-cerrar");
    expect(j.minutosRestantes).toBe(MINUTOS_POR_CERRAR);
  });

  it("17:48:30 quedan 12 minutos", () => {
    const j = calcularJornada(horario, enBA(MARTES, 17, 48, 30));
    expect(j.estado).toBe("por-cerrar");
    expect(j.minutosRestantes).toBe(12);
  });

  it("18:00:00 está cerrada", () => {
    const j = calcularJornada(horario, enBA(MARTES, 18));
    expect(j.estado).toBe("cerrada");
    expect(j.minutosRestantes).toBe(0);
  });

  it("07:59:59 está cerrada", () => {
    expect(calcularJornada(horario, enBA(MARTES, 7, 59, 59)).estado).toBe("cerrada");
  });

  it("un sábado está cerrada todo el día", () => {
    const j = calcularJornada(horario, enBA(21, 10));
    expect(j.estado).toBe("cerrada");
    expect(j.diaHabil).toBe(false);
  });

  it("respeta una franja de 09:30 a 13:00", () => {
    const franja = horarioDe("2026-11-17T10:00:00-03:00", { inicio: "09:30:00", fin: "13:00:00" });
    expect(calcularJornada(franja, enBA(MARTES, 9, 29, 59)).estado).toBe("cerrada");
    expect(calcularJornada(franja, enBA(MARTES, 9, 30)).estado).toBe("abierta");
    expect(calcularJornada(franja, enBA(MARTES, 12, 45)).estado).toBe("por-cerrar");
    expect(calcularJornada(franja, enBA(MARTES, 13)).estado).toBe("cerrada");
  });

  it("59 min 10 s restantes redondean hacia arriba a 60 minutos", () => {
    const j = calcularJornada(horario, enBA(MARTES, 17, 0, 50));
    expect(j.minutosRestantes).toBe(60);
    expect(textoRestante(j.minutosRestantes)).toBe("1 h");
  });

  it("usa la zona del servidor y no la del dispositivo", () => {
    const tokio = horarioDe("2026-11-17T10:00:00-03:00", { zona: "Asia/Tokyo" });
    expect(calcularJornada(tokio, Date.UTC(2026, 10, 17, 0, 0)).reloj).toBe("09:00");
  });
});

describe("textoRestante", () => {
  it.each([
    [220, "3 h 40 min"],
    [185, "3 h 5 min"],
    [60, "1 h"],
    [12, "12 min"],
  ])("%i minutos", (minutos, texto) => {
    expect(textoRestante(minutos)).toBe(texto);
  });
});

describe("días de la franja", () => {
  const casos: [number[], string, string][] = [
    [[1, 2, 3, 4, 5, 6, 7], "Todos los días, de 08:00 a 18:00", "todos los días, de 08:00 a 18:00"],
    [[1, 2, 3, 4, 5], "Lunes a viernes, de 08:00 a 18:00", "de lunes a viernes, de 08:00 a 18:00"],
    [[6, 7, 1], "Sábado a lunes, de 08:00 a 18:00", "de sábado a lunes, de 08:00 a 18:00"],
    [[1, 3, 5], "Lunes, miércoles y viernes, de 08:00 a 18:00", "lunes, miércoles y viernes, de 08:00 a 18:00"],
    [[1, 2], "Lunes y martes, de 08:00 a 18:00", "lunes y martes, de 08:00 a 18:00"],
    [[3], "Miércoles, de 08:00 a 18:00", "miércoles, de 08:00 a 18:00"],
    [[1, 2, 3, 5], "Lunes, martes, miércoles y viernes, de 08:00 a 18:00", "lunes, martes, miércoles y viernes, de 08:00 a 18:00"],
  ];

  it.each(casos)("%j", (dias, franja, enFrase) => {
    const h = horarioDe("2026-11-17T10:00:00-03:00", { dias });
    expect(textoFranja(h)).toBe(franja);
    expect(textoFranjaEnFrase(h)).toBe(enFrase);
  });

  it("ordena y descarta repetidos", () => {
    expect(textoFranja(horarioDe("2026-11-17T10:00:00-03:00", { dias: [5, 1, 3, 1] }))).toBe(
      "Lunes, miércoles y viernes, de 08:00 a 18:00",
    );
  });
});

describe("textos del estado", () => {
  it("textoEstado (RF-18)", () => {
    expect(textoEstado(calcularJornada(horario, enBA(MARTES, 14, 20)))).toBe("Quedan 3 h 40 min de jornada");
    expect(textoEstado(calcularJornada(horario, enBA(MARTES, 17, 48, 30)))).toBe("Cierra en 12 min");
    expect(textoEstado(calcularJornada(horario, enBA(MARTES, 19)))).toBe("Fuera del horario de atención");
  });

  it("textoCompacto (RF-20)", () => {
    expect(textoCompacto(calcularJornada(horario, enBA(MARTES, 14, 20)), horario)).toBe(
      "Cierra 18:00 · quedan 3 h 40 min",
    );
    expect(textoCompacto(calcularJornada(horario, enBA(MARTES, 17, 48, 30)), horario)).toBe("Cierra en 12 min");
    expect(textoCompacto(calcularJornada(horario, enBA(MARTES, 19)), horario)).toBe("Fuera del horario de atención");
  });
});

describe("textoProximaApertura (RF-30)", () => {
  const ahora = enBA(MARTES, 19);

  it("con dato posterior a ahora", () => {
    const h = horarioDe("2026-11-17T19:00:00-03:00", { proxima_apertura: "2026-11-18T08:00:00-03:00" });
    expect(textoProximaApertura(h, ahora)).toBe("Próxima apertura: miércoles 18 de noviembre, 08:00.");
  });

  it("sin dato no hay línea", () => {
    expect(textoProximaApertura(horarioDe("2026-11-17T19:00:00-03:00"), ahora)).toBeNull();
  });

  it("con dato pasado no hay línea", () => {
    const h = horarioDe("2026-11-17T19:00:00-03:00", { proxima_apertura: "2026-11-17T08:00:00-03:00" });
    expect(textoProximaApertura(h, ahora)).toBeNull();
  });
});
