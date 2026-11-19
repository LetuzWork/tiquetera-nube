import type { Permiso } from "../api/types";

export type Seccion = "tickets" | "nuevo" | "reportes";

export interface DefinicionSeccion {
  id: Seccion;
  etiqueta: string;
  ruta: string;
  permiso?: Permiso;
}

export const SECCIONES: DefinicionSeccion[] = [
  { id: "tickets", etiqueta: "Tickets", ruta: "/bandeja" },
  { id: "nuevo", etiqueta: "Nuevo ticket", ruta: "/tickets/nuevo", permiso: "ticket:crear" },
  { id: "reportes", etiqueta: "Reportes", ruta: "/reportes", permiso: "reporte:ver" },
];

export interface DestinoSeccion {
  ruta: string | { pathname: string; search: string };
  estado?: { desdeBandeja: true };
}

export function destinoSeccion(seccion: DefinicionSeccion, ubicacion: { pathname: string; search: string }): DestinoSeccion {
  const enBandeja = ubicacion.pathname === "/bandeja" || ubicacion.pathname === "/tickets/nuevo";
  if (seccion.id !== "nuevo" || !enBandeja) return { ruta: seccion.ruta };
  return { ruta: { pathname: seccion.ruta, search: ubicacion.search }, estado: { desdeBandeja: true } };
}

export function seccionesVisibles(puede: (p: Permiso) => boolean): DefinicionSeccion[] {
  return SECCIONES.filter((s) => !s.permiso || puede(s.permiso));
}

export function seccionActiva(ruta: string): Seccion | null {
  if (ruta === "/tickets/nuevo") return "nuevo";
  if (ruta === "/bandeja" || ruta.startsWith("/tickets/")) return "tickets";
  if (ruta === "/reportes") return "reportes";
  return null;
}
