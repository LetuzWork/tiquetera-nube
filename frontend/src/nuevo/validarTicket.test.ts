import { describe, expect, it } from "vitest";
import { DESCRIPCION_MAX, DESCRIPCION_MIN, TITULO_MAX, TITULO_MIN, validarTicket } from "./validarTicket";

const TITULO_CORTO = "El título necesita al menos 5 caracteres.";
const TITULO_LARGO = "El título admite hasta 120 caracteres.";
const DESCRIPCION_CORTA = "Contá el problema en al menos 10 caracteres.";
const DESCRIPCION_LARGA = "La descripción admite hasta 5000 caracteres.";

const TITULO_VALIDO = "La impresora no imprime";
const DESCRIPCION_VALIDA = "Desde ayer no sale ninguna hoja.";

describe("RF-15: validarTicket", () => {
  it("los límites son 5/120 y 10/5000", () => {
    expect([TITULO_MIN, TITULO_MAX, DESCRIPCION_MIN, DESCRIPCION_MAX]).toEqual([5, 120, 10, 5000]);
  });

  it("con datos válidos no hay errores", () => {
    expect(validarTicket(TITULO_VALIDO, DESCRIPCION_VALIDA)).toEqual({});
  });

  it("vacíos: los dos errores a la vez", () => {
    expect(validarTicket("", "")).toEqual({ titulo: TITULO_CORTO, descripcion: DESCRIPCION_CORTA });
  });

  describe("título", () => {
    it.each([
      ["4 caracteres", "abcd", TITULO_CORTO],
      ["5 caracteres", "abcde", undefined],
      ["120 caracteres", "a".repeat(120), undefined],
      ["121 caracteres", "a".repeat(121), TITULO_LARGO],
    ])("en el borde: %s", (_, titulo, error) => {
      expect(validarTicket(titulo, DESCRIPCION_VALIDA).titulo).toBe(error);
    });

    it("cuenta sobre el texto recortado", () => {
      expect(validarTicket("   abcd   ", DESCRIPCION_VALIDA).titulo).toBe(TITULO_CORTO);
      expect(validarTicket("     ", DESCRIPCION_VALIDA).titulo).toBe(TITULO_CORTO);
      expect(validarTicket("\n\tabcde \n", DESCRIPCION_VALIDA)).toEqual({});
      expect(validarTicket(`  ${"a".repeat(120)}  `, DESCRIPCION_VALIDA)).toEqual({});
    });

    it("cuenta puntos de código, como el servidor: 5 emojis alcanzan y 121 se pasan", () => {
      expect(validarTicket("😀".repeat(5), DESCRIPCION_VALIDA)).toEqual({});
      expect(validarTicket("😀".repeat(120), DESCRIPCION_VALIDA)).toEqual({});
      expect(validarTicket("😀".repeat(121), DESCRIPCION_VALIDA).titulo).toBe(TITULO_LARGO);
    });
  });

  describe("descripción", () => {
    it.each([
      ["9 caracteres", "a".repeat(9), DESCRIPCION_CORTA],
      ["10 caracteres", "a".repeat(10), undefined],
      ["5000 caracteres", "a".repeat(5000), undefined],
      ["5001 caracteres", "a".repeat(5001), DESCRIPCION_LARGA],
    ])("en el borde: %s", (_, descripcion, error) => {
      expect(validarTicket(TITULO_VALIDO, descripcion).descripcion).toBe(error);
    });

    it("cuenta sobre el texto recortado", () => {
      expect(validarTicket(TITULO_VALIDO, `   ${"a".repeat(9)}   `).descripcion).toBe(DESCRIPCION_CORTA);
      expect(validarTicket(TITULO_VALIDO, `\n${"a".repeat(10)}\n\n`)).toEqual({});
      expect(validarTicket(TITULO_VALIDO, `  ${"a".repeat(5000)}  `)).toEqual({});
    });
  });

  it("solo devuelve el error de cada campo inválido", () => {
    expect(validarTicket("a".repeat(121), DESCRIPCION_VALIDA)).toEqual({ titulo: TITULO_LARGO });
    expect(validarTicket(TITULO_VALIDO, "a".repeat(5001))).toEqual({ descripcion: DESCRIPCION_LARGA });
    expect(validarTicket("abc", "a".repeat(5001))).toEqual({ titulo: TITULO_CORTO, descripcion: DESCRIPCION_LARGA });
  });
});
