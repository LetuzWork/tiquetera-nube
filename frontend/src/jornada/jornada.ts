import type { Horario } from "../api/types";
import { fechaHoraLarga, hhmm, instanteDe, partesEnZona, segundosDe } from "../utils/zona";

export type EstadoJornada = "abierta" | "por-cerrar" | "cerrada";

export const MINUTOS_POR_CERRAR = 15;

export interface Jornada {
  estado: EstadoJornada;
  hoy: string;
  reloj: string;
  segundosDelDia: number;
  minutoDelDia: number;
  diaHabil: boolean;
  minutosRestantes: number;
}

const NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export function calcularJornada(horario: Horario, ahora: number): Jornada {
  const p = partesEnZona(ahora, horario.zona);
  const s = p.hora * 3600 + p.minuto * 60 + p.segundo + (((ahora % 1000) + 1000) % 1000) / 1000;
  const inicio = segundosDe(horario.inicio);
  const fin = segundosDe(horario.fin);
  const diaHabil = horario.dias.includes(p.diaSemana);
  const dentro = diaHabil && inicio <= s && s < fin;
  const minutosRestantes = dentro ? Math.ceil((fin - s) / 60) : 0;
  const estado: EstadoJornada = !dentro ? "cerrada" : minutosRestantes <= MINUTOS_POR_CERRAR ? "por-cerrar" : "abierta";
  return {
    estado,
    hoy: p.fecha,
    reloj: `${dosDigitos(p.hora)}:${dosDigitos(p.minuto)}`,
    segundosDelDia: p.hora * 3600 + p.minuto * 60 + p.segundo,
    minutoDelDia: p.hora * 60 + p.minuto,
    diaHabil,
    minutosRestantes,
  };
}

export function textoRestante(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const r = minutos % 60;
  if (h > 0 && r > 0) return `${h} h ${r} min`;
  if (h > 0) return `${h} h`;
  return `${r} min`;
}

function descripcionDias(dias: number[]): { base: string; tramo: boolean } {
  const d = [...new Set(dias)].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
  if (d.length === 7) return { base: "todos los días", tramo: false };
  const anterior = (n: number) => (n === 1 ? 7 : n - 1);
  const siguiente = (n: number) => (n === 7 ? 1 : n + 1);
  const inicios = d.filter((n) => !d.includes(anterior(n)));
  const primero = inicios[0];
  if (d.length >= 3 && inicios.length === 1 && primero !== undefined) {
    let ultimo = primero;
    while (d.includes(siguiente(ultimo))) ultimo = siguiente(ultimo);
    return { base: `${NOMBRES_DIA[primero - 1]} a ${NOMBRES_DIA[ultimo - 1]}`, tramo: true };
  }
  const nombres = d.map((n) => NOMBRES_DIA[n - 1] ?? "");
  if (nombres.length <= 1) return { base: nombres.join(""), tramo: false };
  return { base: `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`, tramo: false };
}

const horasDeFranja = (horario: Horario) => `de ${hhmm(horario.inicio)} a ${hhmm(horario.fin)}`;

export function textoFranja(horario: Horario): string {
  const { base } = descripcionDias(horario.dias);
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}, ${horasDeFranja(horario)}`;
}

export function textoFranjaEnFrase(horario: Horario): string {
  const { base, tramo } = descripcionDias(horario.dias);
  return `${tramo ? "de " : ""}${base}, ${horasDeFranja(horario)}`;
}

const FUERA_DE_HORARIO = "Fuera del horario de atención";

export function textoEstado(jornada: Jornada): string {
  if (jornada.estado === "cerrada") return FUERA_DE_HORARIO;
  if (jornada.estado === "por-cerrar") return `Cierra en ${textoRestante(jornada.minutosRestantes)}`;
  return `Quedan ${textoRestante(jornada.minutosRestantes)} de jornada`;
}

export function textoCompacto(jornada: Jornada, horario: Horario): string {
  if (jornada.estado === "cerrada") return FUERA_DE_HORARIO;
  if (jornada.estado === "por-cerrar") return `Cierra en ${textoRestante(jornada.minutosRestantes)}`;
  return `Cierra ${hhmm(horario.fin)} · quedan ${textoRestante(jornada.minutosRestantes)}`;
}

export function textoProximaApertura(horario: Horario, ahora: number): string | null {
  if (!horario.proxima_apertura) return null;
  const apertura = instanteDe(horario.proxima_apertura);
  if (!(apertura > ahora)) return null;
  return `Próxima apertura: ${fechaHoraLarga(apertura, horario.zona)}.`;
}
