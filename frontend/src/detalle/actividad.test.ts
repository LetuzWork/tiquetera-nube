import { describe, expect, it } from "vitest";
import type { Comentario, Evento, Ticket } from "../api/types";
import { ZONA_PRUEBA } from "../test/fabricas";
import { actividad, cuando, textoEvento, type Entrada } from "./actividad";

const HOY = "2026-11-17";

function evento(campo: string, anterior: string | null, nuevo: string | null, autor: string, fecha: string): Evento {
  return { campo, anterior, nuevo, autor, fecha };
}

function comentario(autor: string, texto: string, creado_en: string): Comentario {
  return { autor, texto, creado_en };
}

function ticket(historial: Evento[], comentarios: Comentario[] = []): Pick<Ticket, "comentarios" | "historial"> {
  return { historial, comentarios };
}

const resumen = (entradas: Entrada[]) =>
  entradas.map((e) => (e.tipo === "comentario" ? `${e.autor}: ${e.texto}` : e.texto));

describe("RF-20: textoEvento", () => {
  it("creación: 'u.usuario creó el ticket'", () => {
    expect(textoEvento(evento("creacion", null, "ABIERTO", "u.usuario", "2026-11-17T19:06:00Z"))).toBe(
      "u.usuario creó el ticket",
    );
  });

  it("estado: 'u.operador cambió el estado de Abierto a En progreso'", () => {
    expect(textoEvento(evento("estado", "ABIERTO", "EN_PROGRESO", "u.operador", "2026-11-17T13:42:00Z"))).toBe(
      "u.operador cambió el estado de Abierto a En progreso",
    );
    expect(textoEvento(evento("estado", "RESUELTO", "CERRADO", "u.admin", "2026-11-17T13:42:00Z"))).toBe(
      "u.admin cambió el estado de Resuelto a Cerrado",
    );
    expect(textoEvento(evento("estado", "CERRADO", "ABIERTO", "u.admin", "2026-11-17T13:42:00Z"))).toBe(
      "u.admin cambió el estado de Cerrado a Abierto",
    );
  });

  it("responsable asignado: 'u.admin asignó a u.operador', también al reasignar", () => {
    expect(textoEvento(evento("responsable", null, "u.operador", "u.admin", "2026-11-17T13:40:00Z"))).toBe(
      "u.admin asignó a u.operador",
    );
    expect(textoEvento(evento("responsable", "u.admin", "u.operador", "u.admin", "2026-11-17T13:40:00Z"))).toBe(
      "u.admin asignó a u.operador",
    );
  });

  it("responsable quitado: 'u.admin quitó el responsable'", () => {
    expect(textoEvento(evento("responsable", "u.operador", null, "u.admin", "2026-11-17T13:41:00Z"))).toBe(
      "u.admin quitó el responsable",
    );
  });

  it("un campo desconocido: '<autor> cambió <campo>'", () => {
    expect(textoEvento(evento("prioridad", "MEDIA", "ALTA", "u.admin", "2026-11-17T13:41:00Z"))).toBe(
      "u.admin cambió prioridad",
    );
    expect(textoEvento(evento("vencimiento", null, "2026-12-01", "u.operador", "2026-11-17T13:41:00Z"))).toBe(
      "u.operador cambió vencimiento",
    );
  });
});

describe("RF-20: actividad", () => {
  it("sin comentarios ni historial, no hay entradas", () => {
    expect(actividad(ticket([]))).toEqual([]);
  });

  it("mezcla comentarios y eventos del más viejo al más nuevo", () => {
    const entradas = actividad(
      ticket(
        [
          evento("estado", "ABIERTO", "EN_PROGRESO", "u.operador", "2026-11-17T13:42:00Z"),
          evento("creacion", null, "ABIERTO", "u.usuario", "2026-11-16T19:06:00Z"),
          evento("responsable", null, "u.operador", "u.admin", "2026-11-17T13:40:00Z"),
        ],
        [
          comentario("u.operador", "Voy para allá.", "2026-11-17T13:45:00Z"),
          comentario("u.usuario", "¿Alguna novedad?", "2026-11-17T12:00:00Z"),
        ],
      ),
    );
    expect(resumen(entradas)).toEqual([
      "u.usuario creó el ticket",
      "u.usuario: ¿Alguna novedad?",
      "u.admin asignó a u.operador",
      "u.operador cambió el estado de Abierto a En progreso",
      "u.operador: Voy para allá.",
    ]);
    expect(entradas.map((e) => e.tipo)).toEqual(["evento", "comentario", "evento", "evento", "comentario"]);
  });

  it("con el mismo instante, el evento va antes que el comentario", () => {
    const instante = "2026-11-17T13:42:00Z";
    const entradas = actividad(
      ticket([evento("estado", "ABIERTO", "EN_PROGRESO", "u.operador", instante)], [
        comentario("u.operador", "Lo tomo yo.", instante),
      ]),
    );
    expect(entradas.map((e) => e.tipo)).toEqual(["evento", "comentario"]);
  });

  it("los empates conservan el orden de llegada dentro de cada tipo", () => {
    const instante = "2026-11-17T13:42:00Z";
    const entradas = actividad(
      ticket(
        [
          evento("estado", "ABIERTO", "EN_PROGRESO", "u.operador", instante),
          evento("responsable", null, "u.operador", "u.operador", instante),
        ],
        [comentario("u.operador", "Primero", instante), comentario("u.operador", "Segundo", instante)],
      ),
    );
    expect(resumen(entradas)).toEqual([
      "u.operador cambió el estado de Abierto a En progreso",
      "u.operador asignó a u.operador",
      "u.operador: Primero",
      "u.operador: Segundo",
    ]);
  });

  it("descarta el evento 'comentario' del historial, porque el comentario ya aparece con su texto", () => {
    const entradas = actividad(
      ticket(
        [
          evento("creacion", null, "ABIERTO", "u.usuario", "2026-11-17T19:06:00Z"),
          evento("comentario", null, "#1", "u.operador", "2026-11-17T19:10:00Z"),
        ],
        [comentario("u.operador", "Ya lo veo.", "2026-11-17T19:10:00Z")],
      ),
    );
    expect(resumen(entradas)).toEqual(["u.usuario creó el ticket", "u.operador: Ya lo veo."]);
  });

  it("cada entrada trae su instante, con los microsegundos de Pydantic, y una clave única", () => {
    const entradas = actividad(
      ticket(
        [
          evento("creacion", null, "ABIERTO", "u.usuario", "2026-11-17T19:06:00.123456Z"),
          evento("estado", "ABIERTO", "EN_PROGRESO", "u.operador", "2026-11-17T19:07:00Z"),
        ],
        [comentario("u.operador", "Hola", "2026-11-17T19:08:00.5Z"), comentario("u.usuario", "Chau", "2026-11-17T19:09:00Z")],
      ),
    );
    expect(entradas.map((e) => e.instante)).toEqual([
      Date.UTC(2026, 10, 17, 19, 6, 0, 123),
      Date.UTC(2026, 10, 17, 19, 7),
      Date.UTC(2026, 10, 17, 19, 8, 0, 500),
      Date.UTC(2026, 10, 17, 19, 9),
    ]);
    expect(new Set(entradas.map((e) => e.clave)).size).toBe(4);
  });

  it("un comentario trae autor y texto", () => {
    const [entrada] = actividad(ticket([], [comentario("u.operador", "Reinicié el router.", "2026-11-17T19:06:00Z")]));
    expect(entrada).toMatchObject({ tipo: "comentario", autor: "u.operador", texto: "Reinicié el router." });
  });
});

describe("RF-20: cuando", () => {
  it("de hoy da la hora en la zona del servidor", () => {
    expect(cuando(Date.UTC(2026, 10, 17, 13, 42), ZONA_PRUEBA, HOY)).toBe("10:42");
    expect(cuando(Date.UTC(2026, 10, 18, 0, 30), ZONA_PRUEBA, HOY)).toBe("21:30");
  });

  it("de otro día da la fecha corta", () => {
    expect(cuando(Date.UTC(2026, 10, 17, 2, 30), ZONA_PRUEBA, HOY)).toBe("16 nov");
    expect(cuando(Date.UTC(2026, 9, 3, 15, 0), ZONA_PRUEBA, HOY)).toBe("3 oct");
  });
});
