import { describe, expect, it } from "vitest";
import { ESTADOS } from "../api/types";
import { ETIQUETA_ESTADO } from "../utils/presentacion";
import { fechaCortaDeDia } from "../utils/zona";
import {
  PERIODOS,
  PERIODO_INICIAL,
  completarDias,
  rangoDePeriodo,
  serie,
  sumarDias,
  textoHoras,
  type Periodo,
} from "./reportes";

describe("RF-28: período", () => {
  it("las opciones del control y '30 días' de inicio", () => {
    expect(PERIODOS.map((p) => p.etiqueta)).toEqual(["7 días", "30 días", "90 días", "Todo"]);
    expect(PERIODOS.map((p) => p.valor)).toEqual(["7", "30", "90", "todo"]);
    expect(PERIODO_INICIAL).toBe("30");
  });

  it.each<[Periodo, string]>([
    ["7", "2026-11-11"],
    ["30", "2026-10-19"],
    ["90", "2026-08-20"],
  ])("%s días: desde hoy menos N−1 días hasta hoy", (periodo, desde) => {
    expect(rangoDePeriodo(periodo, "2026-11-17")).toEqual({ desde, hasta: "2026-11-17" });
  });

  it("'Todo' no pone límites", () => {
    expect(rangoDePeriodo("todo", "2026-11-17")).toEqual({});
  });

  it.each<[Periodo, string, string]>([
    ["7", "2026-03-03", "2026-02-25"],
    ["7", "2028-03-03", "2028-02-26"],
    ["30", "2026-03-15", "2026-02-14"],
    ["7", "2026-12-02", "2026-11-26"],
  ])("con cambio de mes: %s días hasta %s arranca el %s", (periodo, hoy, desde) => {
    expect(rangoDePeriodo(periodo, hoy)).toEqual({ desde, hasta: hoy });
  });

  it.each<[Periodo, string, string]>([
    ["7", "2027-01-03", "2026-12-28"],
    ["30", "2027-01-10", "2026-12-12"],
    ["90", "2027-01-15", "2026-10-18"],
    ["7", "2027-01-01", "2026-12-26"],
  ])("con cambio de año: %s días hasta %s arranca el %s", (periodo, hoy, desde) => {
    expect(rangoDePeriodo(periodo, hoy)).toEqual({ desde, hasta: hoy });
  });

  it("sumarDias cruza meses, años y el 29 de febrero", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2028-03-01", -1)).toBe("2028-02-29");
    expect(sumarDias("2026-11-17", 0)).toBe("2026-11-17");
  });

  it("cruza los días de cambio de horario de EE. UU. y Europa sin saltar ni repetir días", () => {
    expect(sumarDias("2026-03-08", 1)).toBe("2026-03-09");
    expect(sumarDias("2026-11-01", 1)).toBe("2026-11-02");
    expect(sumarDias("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("RF-29: tiempo medio de resolución", () => {
  it("con un decimal: '5.2 h'", () => {
    expect(textoHoras(5.2)).toBe("5.2 h");
    expect(textoHoras(5.23)).toBe("5.2 h");
    expect(textoHoras(5.17)).toBe("5.2 h");
    expect(textoHoras(5)).toBe("5.0 h");
    expect(textoHoras(0)).toBe("0.0 h");
    expect(textoHoras(123.456)).toBe("123.5 h");
  });

  it("sin resueltos: 'Sin datos'", () => {
    expect(textoHoras(null)).toBe("Sin datos");
  });
});

describe("RF-30: serie", () => {
  it("con orden y etiquetas: las claves del orden van primero, con 0 si faltan", () => {
    expect(serie({ RESUELTO: 2, ABIERTO: 4 }, ESTADOS, ETIQUETA_ESTADO)).toEqual([
      { clave: "ABIERTO", etiqueta: "Abierto", valor: 4, fraccion: 1 },
      { clave: "EN_PROGRESO", etiqueta: "En progreso", valor: 0, fraccion: 0 },
      { clave: "RESUELTO", etiqueta: "Resuelto", valor: 2, fraccion: 0.5 },
      { clave: "CERRADO", etiqueta: "Cerrado", valor: 0, fraccion: 0 },
    ]);
  });

  it("las claves que no están en el orden van al final", () => {
    expect(serie({ OTRO: 1, ABIERTO: 2 }, ["ABIERTO", "CERRADO"]).map((p) => p.clave)).toEqual([
      "ABIERTO",
      "CERRADO",
      "OTRO",
    ]);
  });

  it("sin orden, el del objeto; sin etiqueta, la clave", () => {
    expect(serie({ "u.operador": 3, "sin asignar": 1, "u.admin": 6 })).toEqual([
      { clave: "u.operador", etiqueta: "u.operador", valor: 3, fraccion: 0.5 },
      { clave: "sin asignar", etiqueta: "sin asignar", valor: 1, fraccion: 1 / 6 },
      { clave: "u.admin", etiqueta: "u.admin", valor: 6, fraccion: 1 },
    ]);
  });

  it("'sin asignar' se nombra con las etiquetas", () => {
    const puntos = serie({ "u.operador": 2, "sin asignar": 1 }, undefined, { "sin asignar": "Sin asignar" });
    expect(puntos.map((p) => p.etiqueta)).toEqual(["u.operador", "Sin asignar"]);
  });

  it("todo en cero da fracción 0, no NaN; sin datos, una serie vacía", () => {
    expect(serie({ A: 0, B: 0 }).map((p) => p.fraccion)).toEqual([0, 0]);
    expect(serie({})).toEqual([]);
  });

  it("completarDias llena con 0 los días sin tickets, en orden", () => {
    const dias = completarDias({ "2026-11-17": 1, "2026-11-15": 2 }, { desde: "2026-11-14", hasta: "2026-11-17" });
    expect(Object.entries(dias)).toEqual([
      ["2026-11-14", 0],
      ["2026-11-15", 2],
      ["2026-11-16", 0],
      ["2026-11-17", 1],
    ]);
  });

  it("completarDias cruza el fin de año", () => {
    const dias = completarDias({ "2027-01-01": 4 }, { desde: "2026-12-30", hasta: "2027-01-02" });
    expect(Object.keys(dias)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(dias["2027-01-01"]).toBe(4);
  });

  it("completarDias sin rango ('Todo') va del primer día al último", () => {
    const dias = completarDias({ "2026-11-17": 1, "2026-11-14": 3 }, {});
    expect(Object.entries(dias)).toEqual([
      ["2026-11-14", 3],
      ["2026-11-15", 0],
      ["2026-11-16", 0],
      ["2026-11-17", 1],
    ]);
    expect(completarDias({}, {})).toEqual({});
  });

  it("'Por día': la serie de los días completos con la fecha corta", () => {
    const rango = rangoDePeriodo("7", "2026-11-17");
    const puntos = serie(completarDias({ "2026-11-12": 2, "2026-11-17": 4 }, rango)).map((p) => ({
      ...p,
      etiqueta: fechaCortaDeDia(p.clave),
    }));
    expect(puntos.map((p) => `${p.etiqueta}=${p.valor}`)).toEqual([
      "11 nov=0",
      "12 nov=2",
      "13 nov=0",
      "14 nov=0",
      "15 nov=0",
      "16 nov=0",
      "17 nov=4",
    ]);
    expect(puntos.map((p) => p.fraccion)).toEqual([0, 0.5, 0, 0, 0, 0, 1]);
  });
});
