import { describe, expect, it } from "vitest";
import type { TicketResumen } from "../api/types";
import { ZONA_PRUEBA, ticketResumenDe } from "../test/fabricas";
import {
  ETIQUETA_ESTADO_FILTRO,
  POR_PAGINA,
  VISTA_INICIAL,
  agrupar,
  cantidadFiltros,
  cuandoFila,
  detalleFila,
  filtrosDeVista,
  hayFiltros,
  paramsDeVista,
  textoPie,
  textoResumen,
  ultimaPagina,
  vistaDesdeParams,
  type VistaBandeja,
} from "./bandeja";

const HOY = "2026-11-17";

const VISTA_COMPLETA: VistaBandeja = {
  q: "impresora",
  estado: "EN_PROGRESO",
  prioridad: "ALTA",
  categoria: "Red",
  mios: true,
  pagina: 3,
};

const vista = (cambios: Partial<VistaBandeja>): VistaBandeja => ({ ...VISTA_INICIAL, ...cambios });

const params = (texto: string) => new URLSearchParams(texto);

function tickets(cantidad: number, cambios: Partial<TicketResumen> = {}): TicketResumen[] {
  return Array.from({ length: cantidad }, (_, i) => ticketResumenDe({ numero: i + 1, ...cambios }));
}

describe("constantes", () => {
  it("RF-1: 25 tickets por página", () => {
    expect(POR_PAGINA).toBe(25);
  });

  it("RF-6: los nombres de los estados en el control", () => {
    expect(ETIQUETA_ESTADO_FILTRO).toEqual({
      ABIERTO: "Abiertos",
      EN_PROGRESO: "En progreso",
      RESUELTO: "Resueltos",
      CERRADO: "Cerrados",
    });
  });
});

describe("RF-8: la vista en la dirección", () => {
  it("sin parámetros es la vista inicial", () => {
    expect(vistaDesdeParams(params(""))).toEqual(VISTA_INICIAL);
    expect(VISTA_INICIAL).toEqual({ q: "", estado: null, prioridad: null, categoria: null, mios: false, pagina: 1 });
  });

  it("lee búsqueda, estado, prioridad, categoría, mios y página", () => {
    const leida = vistaDesdeParams(params("q=impresora&estado=EN_PROGRESO&prioridad=ALTA&categoria=Red&mios=1&pagina=3"));
    expect(leida).toEqual(VISTA_COMPLETA);
  });

  it.each([
    ["estado=abierto", { estado: null }],
    ["estado=PENDIENTE", { estado: null }],
    ["prioridad=URGENTE", { prioridad: null }],
    ["prioridad=alta", { prioridad: null }],
    ["categoria=red", { categoria: null }],
    ["categoria=Impresoras", { categoria: null }],
    ["mios=true", { mios: false }],
    ["mios=0", { mios: false }],
    ["mios=", { mios: false }],
  ])("un valor desconocido toma el valor por omisión: %s", (texto, esperado) => {
    expect(vistaDesdeParams(params(texto))).toEqual(vista(esperado));
  });

  it.each(["pagina=0", "pagina=-2", "pagina=abc", "pagina=2.5", "pagina=", "pagina=NaN", "pagina=Infinity"])(
    "una página que no es un entero ≥ 1 queda en 1: %s",
    (texto) => {
      expect(vistaDesdeParams(params(texto)).pagina).toBe(1);
    },
  );

  it("una página fuera de rango se conserva (la pantalla la lleva a la última)", () => {
    expect(vistaDesdeParams(params("pagina=99")).pagina).toBe(99);
  });

  it("la vista inicial no deja nada en la dirección", () => {
    expect(paramsDeVista(VISTA_INICIAL).toString()).toBe("");
  });

  it("escribe todo lo que no está por omisión", () => {
    expect(paramsDeVista(VISTA_COMPLETA).toString()).toBe(
      "q=impresora&estado=EN_PROGRESO&prioridad=ALTA&categoria=Red&mios=1&pagina=3",
    );
  });

  it("omite la página 1 y una búsqueda solo de espacios", () => {
    expect(paramsDeVista(vista({ q: "   ", pagina: 1, estado: "CERRADO" })).toString()).toBe("estado=CERRADO");
  });

  it("ida y vuelta: la dirección devuelve la misma vista, también con caracteres especiales", () => {
    for (const original of [VISTA_COMPLETA, vista({ q: "piso 3° & red / wifi?", pagina: 2 }), VISTA_INICIAL]) {
      expect(vistaDesdeParams(new URLSearchParams(paramsDeVista(original).toString()))).toEqual(original);
    }
  });
});

describe("RF-7: filtros de la consulta", () => {
  it("la vista inicial no filtra nada", () => {
    expect(filtrosDeVista(VISTA_INICIAL, "u.operador")).toEqual({});
  });

  it("con mios, el responsable es quien consulta; la búsqueda va recortada y la página no es filtro", () => {
    expect(filtrosDeVista({ ...VISTA_COMPLETA, q: "  impresora  " }, "u.operador")).toEqual({
      q: "impresora",
      estado: "EN_PROGRESO",
      prioridad: "ALTA",
      categoria: "Red",
      responsable: "u.operador",
    });
  });

  it("sin mios no pide responsable", () => {
    expect(filtrosDeVista(vista({ prioridad: "BAJA" }), "u.operador")).toEqual({ prioridad: "BAJA" });
  });

  it("una búsqueda solo de espacios no se manda", () => {
    expect(filtrosDeVista(vista({ q: "   " }), "u.operador")).toEqual({});
  });

  it("'Filtros · N' cuenta prioridad, categoría y mios, no el estado ni la búsqueda", () => {
    expect(cantidadFiltros(VISTA_INICIAL)).toBe(0);
    expect(cantidadFiltros(vista({ q: "red", estado: "ABIERTO", pagina: 4 }))).toBe(0);
    expect(cantidadFiltros(vista({ prioridad: "ALTA" }))).toBe(1);
    expect(cantidadFiltros(vista({ prioridad: "ALTA", categoria: "Red" }))).toBe(2);
    expect(cantidadFiltros(VISTA_COMPLETA)).toBe(3);
  });

  it("RF-10: hayFiltros mira búsqueda, estado y filtros, pero no la página", () => {
    expect(hayFiltros(VISTA_INICIAL)).toBe(false);
    expect(hayFiltros(vista({ pagina: 3 }))).toBe(false);
    expect(hayFiltros(vista({ q: "   " }))).toBe(false);
    expect(hayFiltros(vista({ q: "red" }))).toBe(true);
    expect(hayFiltros(vista({ estado: "RESUELTO" }))).toBe(true);
    expect(hayFiltros(vista({ categoria: "Otro" }))).toBe(true);
    expect(hayFiltros(vista({ mios: true }))).toBe(true);
  });
});

describe("RF-2: resumen de hoy", () => {
  it("si la consulta de hoy falla, no hay resumen", () => {
    expect(textoResumen(null, null)).toBeNull();
    expect(textoResumen(null, 5)).toBeNull();
  });

  it("con cero: 'Hoy no entró ningún ticket.'", () => {
    expect(textoResumen([], 0)).toBe("Hoy no entró ningún ticket.");
    expect(textoResumen([], null)).toBe("Hoy no entró ningún ticket.");
  });

  it("uno sin tomar: '1 entró hoy y 1 sigue sin tomar.'", () => {
    expect(textoResumen(tickets(1), 1)).toBe("1 entró hoy y 1 sigue sin tomar.");
  });

  it("uno con responsable, ninguno sin tomar: '1 entró hoy y ninguno sigue sin tomar.'", () => {
    expect(textoResumen(tickets(1, { responsable: "u.operador" }), 1)).toBe("1 entró hoy y ninguno sigue sin tomar.");
  });

  it("varios, con 3 sin tomar: '5 entraron hoy y 3 siguen sin tomar.'", () => {
    const items = [...tickets(3), ...tickets(2, { estado: "EN_PROGRESO", responsable: "u.operador" })];
    expect(textoResumen(items, 5)).toBe("5 entraron hoy y 3 siguen sin tomar.");
  });

  it("varios, ninguno sin tomar: '5 entraron hoy y ninguno sigue sin tomar.'", () => {
    expect(textoResumen(tickets(5, { responsable: "u.operador" }), 5)).toBe("5 entraron hoy y ninguno sigue sin tomar.");
  });

  it("varios, con 1 sin tomar: '4 entraron hoy y 1 sigue sin tomar.'", () => {
    const items = [
      ticketResumenDe({ numero: 1, estado: "ABIERTO", responsable: null }),
      ticketResumenDe({ numero: 2, estado: "ABIERTO", responsable: "u.operador" }),
      ticketResumenDe({ numero: 3, estado: "EN_PROGRESO", responsable: "u.admin" }),
      ticketResumenDe({ numero: 4, estado: "RESUELTO", responsable: "u.admin" }),
    ];
    expect(textoResumen(items, 4)).toBe("4 entraron hoy y 1 sigue sin tomar.");
  });

  it("'sin tomar' es Abierto y sin responsable: un Abierto asignado no cuenta", () => {
    const items = [
      ticketResumenDe({ numero: 1, estado: "ABIERTO", responsable: "u.operador" }),
      ticketResumenDe({ numero: 2, estado: "ABIERTO", responsable: "u.admin" }),
    ];
    expect(textoResumen(items, 2)).toBe("2 entraron hoy y ninguno sigue sin tomar.");
  });

  it("un En progreso o Resuelto sin responsable no cuenta como sin tomar", () => {
    const items = [
      ticketResumenDe({ numero: 1, estado: "EN_PROGRESO", responsable: null }),
      ticketResumenDe({ numero: 2, estado: "RESUELTO", responsable: null }),
    ];
    expect(textoResumen(items, 2)).toBe("2 entraron hoy y ninguno sigue sin tomar.");
  });

  it("'entraron' usa el total del servidor, aunque la página traiga menos", () => {
    expect(textoResumen(tickets(25), 30)).toBe("30 entraron hoy y 25 siguen sin tomar.");
  });

  it("sin total, cuenta los que llegaron", () => {
    expect(textoResumen(tickets(2), null)).toBe("2 entraron hoy y 2 siguen sin tomar.");
  });
});

describe("RF-3: grupos 'Hoy' y 'Anteriores' en la zona del servidor", () => {
  const de1606 = ticketResumenDe({ numero: 10, creado_en: "2026-11-17T19:06:00Z" });
  const de0006 = ticketResumenDe({ numero: 9, creado_en: "2026-11-17T03:06:00Z" });
  const de2130 = ticketResumenDe({ numero: 11, creado_en: "2026-11-18T00:30:00Z" });
  const ayer2330 = ticketResumenDe({ numero: 8, creado_en: "2026-11-17T02:30:00Z" });
  const del14 = ticketResumenDe({ numero: 3, creado_en: "2026-11-14T13:00:00Z" });

  it("un ticket de las 00:06 de hoy va en 'Hoy'", () => {
    expect(agrupar([de0006], ZONA_PRUEBA, HOY)).toEqual([{ nombre: "Hoy", items: [de0006] }]);
  });

  it("las 23:30 de ayer en Buenos Aires van en 'Anteriores', aunque en UTC y en Tokio ya sea 17", () => {
    expect(agrupar([ayer2330], ZONA_PRUEBA, HOY)).toEqual([{ nombre: "Anteriores", items: [ayer2330] }]);
  });

  it("las 21:30 de hoy en Buenos Aires van en 'Hoy', aunque en UTC y en Tokio ya sea 18", () => {
    expect(agrupar([de2130], ZONA_PRUEBA, HOY)).toEqual([{ nombre: "Hoy", items: [de2130] }]);
  });

  it("conserva el orden del servidor dentro de cada grupo", () => {
    const grupos = agrupar([de2130, ayer2330, de1606, del14, de0006], ZONA_PRUEBA, HOY);
    expect(grupos).toEqual([
      { nombre: "Hoy", items: [de2130, de1606, de0006] },
      { nombre: "Anteriores", items: [ayer2330, del14] },
    ]);
  });

  it("no muestra un grupo vacío", () => {
    expect(agrupar([del14, ayer2330], ZONA_PRUEBA, HOY).map((g) => g.nombre)).toEqual(["Anteriores"]);
    expect(agrupar([de1606], ZONA_PRUEBA, HOY).map((g) => g.nombre)).toEqual(["Hoy"]);
    expect(agrupar([], ZONA_PRUEBA, HOY)).toEqual([]);
  });

  it("la zona entra como parámetro: en UTC, las 02:30Z del 17 son de hoy", () => {
    expect(agrupar([ayer2330], "UTC", HOY).map((g) => g.nombre)).toEqual(["Hoy"]);
  });
});

describe("RF-4: la fila", () => {
  it("de hoy muestra la hora en la zona del servidor", () => {
    expect(cuandoFila("2026-11-17T19:06:00Z", ZONA_PRUEBA, HOY)).toBe("16:06");
    expect(cuandoFila("2026-11-17T03:06:00Z", ZONA_PRUEBA, HOY)).toBe("00:06");
    expect(cuandoFila("2026-11-18T00:30:00Z", ZONA_PRUEBA, HOY)).toBe("21:30");
  });

  it("acepta los microsegundos de Pydantic", () => {
    expect(cuandoFila("2026-11-17T19:06:00.123456Z", ZONA_PRUEBA, HOY)).toBe("16:06");
    expect(cuandoFila("2026-11-17T16:06:00.654321-03:00", ZONA_PRUEBA, HOY)).toBe("16:06");
  });

  it("anterior muestra la fecha corta", () => {
    expect(cuandoFila("2026-11-17T02:30:00Z", ZONA_PRUEBA, HOY)).toBe("16 nov");
    expect(cuandoFila("2026-11-14T13:00:00Z", ZONA_PRUEBA, HOY)).toBe("14 nov");
    expect(cuandoFila("2026-01-01T02:00:00Z", ZONA_PRUEBA, HOY)).toBe("31 dic");
  });

  it("el detalle: 'TQ-000005 Red, lo pidió u.usuario'", () => {
    expect(detalleFila(ticketResumenDe({ numero: 5, categoria: "Red", solicitante: "u.usuario" }))).toBe(
      "TQ-000005 Red, lo pidió u.usuario",
    );
    expect(detalleFila(ticketResumenDe({ numero: 132, categoria: "Accesos", solicitante: "u.admin" }))).toBe(
      "TQ-000132 Accesos, lo pidió u.admin",
    );
  });
});

describe("RF-9: pie de página", () => {
  it("'1–25 de 132' con raya", () => {
    expect(textoPie(1, 25, 132)).toBe("1–25 de 132");
    expect(textoPie(1, 25, 132)).toContain("–");
  });

  it("las páginas siguientes y la última, incompleta", () => {
    expect(textoPie(2, 25, 132)).toBe("26–50 de 132");
    expect(textoPie(6, 25, 132)).toBe("126–132 de 132");
  });

  it("una página fuera de rango se recorta a la última, y una menor a 1 a la primera", () => {
    expect(textoPie(99, 25, 132)).toBe("126–132 de 132");
    expect(textoPie(0, 25, 10)).toBe("1–10 de 10");
  });

  it("con uno, con 25 justos y sin tickets", () => {
    expect(textoPie(1, 25, 1)).toBe("1–1 de 1");
    expect(textoPie(1, 25, 25)).toBe("1–25 de 25");
    expect(textoPie(1, 25, 0)).toBe("0 de 0");
  });

  it("ultimaPagina, con mínimo 1", () => {
    expect(ultimaPagina(132, 25)).toBe(6);
    expect(ultimaPagina(125, 25)).toBe(5);
    expect(ultimaPagina(126, 25)).toBe(6);
    expect(ultimaPagina(25, 25)).toBe(1);
    expect(ultimaPagina(1, 25)).toBe(1);
    expect(ultimaPagina(0, 25)).toBe(1);
  });
});
