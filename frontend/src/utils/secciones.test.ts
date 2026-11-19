import { describe, expect, it } from "vitest";
import type { Permiso } from "../api/types";
import { SECCIONES, destinoSeccion, seccionActiva, seccionesVisibles } from "./secciones";

const puedeCon = (...permisos: Permiso[]) => (p: Permiso) => permisos.includes(p);

describe("seccionesVisibles", () => {
  const etiquetas = (puede: (p: Permiso) => boolean) => seccionesVisibles(puede).map((s) => s.etiqueta);

  it("Admin ve las tres", () => {
    expect(etiquetas(puedeCon("ticket:crear", "reporte:ver"))).toEqual(["Tickets", "Nuevo ticket", "Reportes"]);
  });

  it("Operador ve las tres", () => {
    expect(etiquetas(puedeCon("ticket:crear", "reporte:ver"))).toHaveLength(3);
  });

  it("Usuario ve Tickets y Nuevo ticket", () => {
    expect(etiquetas(puedeCon("ticket:crear"))).toEqual(["Tickets", "Nuevo ticket"]);
  });

  it("Consulta ve Tickets y Reportes", () => {
    expect(etiquetas(puedeCon("reporte:ver"))).toEqual(["Tickets", "Reportes"]);
  });

  it("sin permisos ve solo Tickets", () => {
    expect(etiquetas(puedeCon())).toEqual(["Tickets"]);
  });

  it("cada sección apunta a su ruta", () => {
    expect(SECCIONES.map((s) => [s.id, s.ruta])).toEqual([
      ["tickets", "/bandeja"],
      ["nuevo", "/tickets/nuevo"],
      ["reportes", "/reportes"],
    ]);
  });
});

describe("seccionActiva", () => {
  it.each([
    ["/bandeja", "tickets"],
    ["/tickets/45", "tickets"],
    ["/tickets/nuevo", "nuevo"],
    ["/reportes", "reportes"],
    ["/otra", null],
    ["/ventanilla", null],
  ])("%s marca %s", (ruta, esperada) => {
    expect(seccionActiva(ruta)).toBe(esperada);
  });
});

describe("destinoSeccion", () => {
  const seccion = (id: string) => {
    const encontrada = SECCIONES.find((s) => s.id === id);
    if (!encontrada) throw new Error(`No existe la sección ${id}`);
    return encontrada;
  };

  it.each([
    ["/bandeja", "?estado=ABIERTO&q=vpn"],
    ["/tickets/nuevo", "?estado=ABIERTO"],
    ["/bandeja", ""],
  ])("RF-14 y RF-8: 'Nuevo ticket' desde %s conserva la búsqueda '%s' y avisa que viene de la bandeja", (pathname, search) => {
    expect(destinoSeccion(seccion("nuevo"), { pathname, search })).toEqual({
      ruta: { pathname: "/tickets/nuevo", search },
      estado: { desdeBandeja: true },
    });
  });

  it.each([
    ["/reportes", "?periodo=7"],
    ["/tickets/45", "?estado=ABIERTO"],
    ["/otra", ""],
  ])("'Nuevo ticket' desde %s lleva a /tickets/nuevo a secas", (pathname, search) => {
    expect(destinoSeccion(seccion("nuevo"), { pathname, search })).toEqual({ ruta: "/tickets/nuevo" });
  });

  it.each(["tickets", "reportes"])("la sección %s lleva a su ruta sin búsqueda ni estado, aun desde la bandeja", (id) => {
    expect(destinoSeccion(seccion(id), { pathname: "/bandeja", search: "?estado=ABIERTO" })).toEqual({ ruta: seccion(id).ruta });
  });
});
