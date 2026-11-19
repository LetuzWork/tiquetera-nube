import { describe, expect, it } from "vitest";
import { accionAnteCaida } from "./caida";

describe("accionAnteCaida", () => {
  it("SESION_FUERA_DE_HORARIO sin fin termina la jornada", () => {
    expect(accionAnteCaida("SESION_FUERA_DE_HORARIO", { fin: null })).toBe("fin-jornada");
  });

  it("SESION_INVALIDA sin fin saca a la persona", () => {
    expect(accionAnteCaida("SESION_INVALIDA", { fin: null })).toBe("salir");
  });

  it("cualquier otro código sin fin saca a la persona", () => {
    expect(accionAnteCaida("OTRO", { fin: null })).toBe("salir");
  });

  it("con el fin marcado, cualquier código se ignora", () => {
    expect(accionAnteCaida("SESION_FUERA_DE_HORARIO", { fin: "duracion" })).toBe("ignorar");
    expect(accionAnteCaida("SESION_INVALIDA", { fin: "jornada" })).toBe("ignorar");
    expect(accionAnteCaida("OTRO", { fin: "jornada" })).toBe("ignorar");
  });
});
