import { describe, expect, it } from "vitest";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  ETIQUETA_ROL,
  MARCA_PRIORIDAD,
  NOMBRE_PRIORIDAD,
  iniciales,
  largoTexto,
} from "./presentacion";

describe("iniciales", () => {
  it.each([
    ["Omar Operador", "OO"],
    ["María José de la Fuente", "MF"],
    ["u.admin", "UA"],
    ["Ana", "AN"],
    ["de la Fuente", "FU"],
    ["ana-maria_lopez", "AL"],
    ["  Omar   Operador  ", "OO"],
  ])("%s da %s", (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado);
  });
});

describe("etiquetas", () => {
  it("estados", () => {
    expect(ETIQUETA_ESTADO).toEqual({
      ABIERTO: "Abierto",
      EN_PROGRESO: "En progreso",
      RESUELTO: "Resuelto",
      CERRADO: "Cerrado",
    });
  });

  it("roles", () => {
    expect(ETIQUETA_ROL).toEqual({
      admin: "Admin",
      operador: "Operador",
      usuario: "Usuario",
      consulta: "Consulta",
    });
  });
});

describe("prioridad", () => {
  it("RF-19: las etiquetas", () => {
    expect(ETIQUETA_PRIORIDAD).toEqual({ BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica" });
  });

  it("RF-4: la marca: nada para Baja, '!' Media, '!!' Alta y '!!!' Crítica", () => {
    expect(MARCA_PRIORIDAD).toEqual({ BAJA: "", MEDIA: "!", ALTA: "!!", CRITICA: "!!!" });
  });

  it("RF-4: el nombre accesible", () => {
    expect(NOMBRE_PRIORIDAD).toEqual({
      BAJA: "Prioridad baja",
      MEDIA: "Prioridad media",
      ALTA: "Prioridad alta",
      CRITICA: "Prioridad crítica",
    });
  });
});

describe("largoTexto", () => {
  it.each([
    ["", 0],
    ["Impresora", 9],
    ["ñandú", 5],
    ["😀", 1],
    ["🖨😀 ok", 5],
  ])("%j mide %i puntos de código, como cuenta el servidor", (texto, largo) => {
    expect(largoTexto(texto)).toBe(largo);
  });
});
