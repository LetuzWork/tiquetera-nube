import type { Estado, Evento, Ticket } from "../api/types";
import { ETIQUETA_ESTADO } from "../utils/presentacion";
import { horaOFecha, instanteDe } from "../utils/zona";

export type Entrada =
  | { tipo: "comentario"; clave: string; autor: string; texto: string; instante: number }
  | { tipo: "evento"; clave: string; texto: string; instante: number };

function etiquetaEstado(valor: string | null): string {
  if (valor === null) return "—";
  return valor in ETIQUETA_ESTADO ? ETIQUETA_ESTADO[valor as Estado] : valor;
}

export function textoEvento(e: Evento): string {
  switch (e.campo) {
    case "creacion":
      return `${e.autor} creó el ticket`;
    case "estado":
      return `${e.autor} cambió el estado de ${etiquetaEstado(e.anterior)} a ${etiquetaEstado(e.nuevo)}`;
    case "responsable":
      return e.nuevo !== null ? `${e.autor} asignó a ${e.nuevo}` : `${e.autor} quitó el responsable`;
    default:
      return `${e.autor} cambió ${e.campo}`;
  }
}

export function actividad(ticket: Pick<Ticket, "comentarios" | "historial">): Entrada[] {
  const eventos: Entrada[] = ticket.historial
    // El comentario ya aparece con su texto: su evento del historial lo repetiría.
    .filter((e) => e.campo !== "comentario")
    .map((e, i) => ({ tipo: "evento", clave: `evento-${i}`, texto: textoEvento(e), instante: instanteDe(e.fecha) }));
  const comentarios: Entrada[] = ticket.comentarios.map((c, i) => ({
    tipo: "comentario",
    clave: `comentario-${i}`,
    autor: c.autor,
    texto: c.texto,
    instante: instanteDe(c.creado_en),
  }));
  // sort es estable: con el mismo instante, los eventos quedan antes que los comentarios.
  return [...eventos, ...comentarios].sort((a, b) => a.instante - b.instante);
}

export function cuando(instante: number, zona: string, hoy: string): string {
  return horaOFecha(instante, zona, hoy);
}
