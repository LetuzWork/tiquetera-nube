import { describe, expect, it } from "vitest";
import { horarioDe, ticketResumenDe } from "../test/fabricas";
import {
  accionAlTocar,
  etiquetaMarca,
  indiceSiguiente,
  marcasDelDia,
  nombreHorizonte,
  porcentaje,
  posicionEnFranja,
  textoCuenta,
} from "./horizonte";
import { calcularJornada } from "./jornada";

const horario = horarioDe("2026-11-17T10:00:00-03:00");
const enBA = (h: number, m = 0) => Date.UTC(2026, 10, 17, h + 3, m);

describe("posicionEnFranja", () => {
  it("07:00 queda en 0, 13:00 en 0.5 y 19:00 en 1", () => {
    expect(posicionEnFranja(7 * 3600, horario)).toBe(0);
    expect(posicionEnFranja(13 * 3600, horario)).toBe(0.5);
    expect(posicionEnFranja(19 * 3600, horario)).toBe(1);
  });

  it("los bordes de la franja dan 0 y 1", () => {
    expect(posicionEnFranja(8 * 3600, horario)).toBe(0);
    expect(posicionEnFranja(18 * 3600, horario)).toBe(1);
  });
});

describe("marcasDelDia", () => {
  it("ordena por instante ascendente, con la hora en la zona del servidor", () => {
    const items = [
      ticketResumenDe({ numero: 49, creado_en: "2026-11-17T15:05:00Z" }),
      ticketResumenDe({ numero: 45, creado_en: "2026-11-17T11:00:00Z", estado: "RESUELTO" }),
    ];
    const marcas = marcasDelDia(items, horario);
    expect(marcas.map((m) => m.numero)).toEqual([45, 49]);
    expect(marcas[0]).toEqual({ numero: 45, id: "TQ-000045", estado: "RESUELTO", hora: "08:00", posicion: 0 });
    expect(marcas[1]?.hora).toBe("12:05");
    expect(marcas[1]?.posicion).toBeCloseTo(4.0833 / 10, 3);
  });

  it("con el mismo instante desempata por número", () => {
    const items = [
      ticketResumenDe({ numero: 52, creado_en: "2026-11-17T15:00:00Z" }),
      ticketResumenDe({ numero: 50, creado_en: "2026-11-17T15:00:00Z" }),
    ];
    expect(marcasDelDia(items, horario).map((m) => m.numero)).toEqual([50, 52]);
  });

  it("una hora fuera de la franja queda en el borde más cercano", () => {
    const items = [
      ticketResumenDe({ numero: 1, creado_en: "2026-11-17T09:30:00Z" }),
      ticketResumenDe({ numero: 2, creado_en: "2026-11-17T23:30:00Z" }),
    ];
    const marcas = marcasDelDia(items, horario);
    expect(marcas.map((m) => m.posicion)).toEqual([0, 1]);
    expect(marcas.map((m) => m.hora)).toEqual(["06:30", "20:30"]);
  });

  it("sin tickets no hay marcas", () => {
    expect(marcasDelDia([], horario)).toEqual([]);
  });
});

describe("textoCuenta", () => {
  it("los seis textos de la cuenta", () => {
    expect(textoCuenta(5, false)).toBe("Hoy entraron 5 tickets.");
    expect(textoCuenta(1, false)).toBe("Hoy entró 1 ticket.");
    expect(textoCuenta(0, false)).toBe("Hoy no entró ningún ticket.");
    expect(textoCuenta(2, true)).toBe("Hoy entraron 2 tickets tuyos.");
    expect(textoCuenta(1, true)).toBe("Hoy entró 1 ticket tuyo.");
    expect(textoCuenta(0, true)).toBe("Hoy no entró ningún ticket tuyo.");
  });

  it("la falla de la consulta, sea cual sea el rol", () => {
    expect(textoCuenta(null, false)).toBe("No se pudieron cargar los tickets de hoy.");
    expect(textoCuenta(null, true)).toBe("No se pudieron cargar los tickets de hoy.");
  });
});

describe("nombreHorizonte", () => {
  const jornada = calcularJornada(horario, enBA(14, 20));

  it("dice la franja y la hora, seguidas de la cuenta", () => {
    expect(nombreHorizonte(horario, jornada, "Hoy entraron 5 tickets.")).toBe(
      "Jornada de 08:00 a 18:00. Son las 14:20. Hoy entraron 5 tickets.",
    );
  });

  it("sin cuenta termina en la hora", () => {
    expect(nombreHorizonte(horario, jornada, null)).toBe("Jornada de 08:00 a 18:00. Son las 14:20.");
  });
});

describe("etiquetaMarca", () => {
  it("número, hora y estado", () => {
    const marca = { numero: 49, id: "TQ-000049", estado: "ABIERTO" as const, hora: "12:05", posicion: 0.4 };
    expect(etiquetaMarca(marca)).toBe("TQ-000049 · 12:05 · Abierto");
    expect(etiquetaMarca({ ...marca, estado: "EN_PROGRESO" })).toBe("TQ-000049 · 12:05 · En progreso");
  });
});

describe("indiceSiguiente", () => {
  it("las flechas avanzan y retroceden sin dar la vuelta", () => {
    expect(indiceSiguiente(1, "ArrowRight", 4)).toBe(2);
    expect(indiceSiguiente(1, "ArrowDown", 4)).toBe(2);
    expect(indiceSiguiente(1, "ArrowLeft", 4)).toBe(0);
    expect(indiceSiguiente(1, "ArrowUp", 4)).toBe(0);
    expect(indiceSiguiente(0, "ArrowLeft", 4)).toBe(0);
    expect(indiceSiguiente(3, "ArrowRight", 4)).toBe(3);
  });

  it("Inicio y Fin van a los extremos", () => {
    expect(indiceSiguiente(2, "Home", 4)).toBe(0);
    expect(indiceSiguiente(1, "End", 4)).toBe(3);
  });

  it("otra tecla deja el índice igual", () => {
    expect(indiceSiguiente(2, "a", 4)).toBe(2);
    expect(indiceSiguiente(2, "Tab", 4)).toBe(2);
  });
});

describe("porcentaje", () => {
  it("lleva la fracción a porcentaje con dos decimales como máximo", () => {
    expect(porcentaje(0.633333)).toBe("63.33%");
    expect(porcentaje(0)).toBe("0%");
    expect(porcentaje(0.5)).toBe("50%");
    expect(porcentaje(1)).toBe("100%");
  });
});

describe("accionAlTocar", () => {
  it("muestra cuando no hay etiqueta o es la de otra marca", () => {
    expect(accionAlTocar(null, 49)).toBe("mostrar");
    expect(accionAlTocar(45, 49)).toBe("mostrar");
  });

  it("abre cuando la etiqueta es la de la propia marca", () => {
    expect(accionAlTocar(49, 49)).toBe("abrir");
  });
});
