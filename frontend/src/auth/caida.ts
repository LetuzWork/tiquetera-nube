import type { MotivoFin } from "./sesion";

export type AccionCaida = "ignorar" | "fin-jornada" | "salir";

export function accionAnteCaida(codigo: string, estado: { fin: MotivoFin | null }): AccionCaida {
  if (estado.fin !== null) return "ignorar";
  return codigo === "SESION_FUERA_DE_HORARIO" ? "fin-jornada" : "salir";
}
