import type { Estado, Horario, TicketResumen } from "../api/types";
import { ETIQUETA_ESTADO } from "../utils/presentacion";
import { hhmm, instanteDe, partesEnZona, segundosDe } from "../utils/zona";
import type { Jornada } from "./jornada";

export interface Marca {
  numero: number;
  id: string;
  estado: Estado;
  hora: string;
  posicion: number;
}

export function posicionEnFranja(segundosDelDia: number, horario: Horario): number {
  const inicio = segundosDe(horario.inicio);
  const fin = segundosDe(horario.fin);
  if (fin <= inicio) return 0;
  return Math.min(1, Math.max(0, (segundosDelDia - inicio) / (fin - inicio)));
}

export function marcasDelDia(items: TicketResumen[], horario: Horario): Marca[] {
  return items
    .map((item) => {
      const instante = instanteDe(item.creado_en);
      const p = partesEnZona(instante, horario.zona);
      const marca: Marca = {
        numero: item.numero,
        id: item.id,
        estado: item.estado,
        hora: `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`,
        posicion: posicionEnFranja(p.hora * 3600 + p.minuto * 60 + p.segundo, horario),
      };
      return { instante, marca };
    })
    .sort((a, b) => a.instante - b.instante || a.marca.numero - b.marca.numero)
    .map(({ marca }) => marca);
}

export function textoCuenta(total: number | null, deUsuario: boolean): string {
  if (total === null) return "No se pudieron cargar los tickets de hoy.";
  if (total === 0) return `Hoy no entró ningún ticket${deUsuario ? " tuyo" : ""}.`;
  if (total === 1) return `Hoy entró 1 ticket${deUsuario ? " tuyo" : ""}.`;
  return `Hoy entraron ${total} tickets${deUsuario ? " tuyos" : ""}.`;
}

export function nombreHorizonte(horario: Horario, jornada: Jornada, cuenta: string | null): string {
  const base = `Jornada de ${hhmm(horario.inicio)} a ${hhmm(horario.fin)}. Son las ${jornada.reloj}.`;
  return cuenta ? `${base} ${cuenta}` : base;
}

export function etiquetaMarca(marca: Marca): string {
  return `${marca.id} · ${marca.hora} · ${ETIQUETA_ESTADO[marca.estado]}`;
}

export function indiceSiguiente(actual: number, tecla: string, cantidad: number): number {
  const ultimo = cantidad - 1;
  switch (tecla) {
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(0, actual - 1);
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(ultimo, actual + 1);
    case "Home":
      return 0;
    case "End":
      return Math.max(0, ultimo);
    default:
      return actual;
  }
}

export function accionAlTocar(conEtiqueta: number | null, numero: number): "mostrar" | "abrir" {
  return conEtiqueta === numero ? "abrir" : "mostrar";
}

export function porcentaje(fraccion: number): string {
  return `${Number((fraccion * 100).toFixed(2))}%`;
}
