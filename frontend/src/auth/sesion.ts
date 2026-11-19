import type { Horario, Me } from "../api/types";
import { calcularJornada, textoFranjaEnFrase } from "../jornada/jornada";
import { horaMinuto, instanteDe } from "../utils/zona";

export const MS_AVISO_SESION = 300_000;

export type FaseSesion = "vigente" | "por-vencer" | "vencida";

export type MotivoFin = "jornada" | "duracion";

export function faseSesion(msRestantes: number): FaseSesion {
  if (msRestantes <= 0) return "vencida";
  if (msRestantes <= MS_AVISO_SESION) return "por-vencer";
  return "vigente";
}

export function msHastaVencimiento(me: Me, ahoraServidor: number | null, recibidoEn: number, marca: number): number {
  if (ahoraServidor !== null) return instanteDe(me.sesion_expira) - ahoraServidor;
  return recibidoEn + me.segundos_restantes * 1000 - marca;
}

export function motivoDeVencimiento(sesionExpira: string, horario: Horario | null): MotivoFin {
  if (!horario) return "duracion";
  return calcularJornada(horario, instanteDe(sesionExpira)).estado === "cerrada" ? "jornada" : "duracion";
}

export function textosFin(
  motivo: MotivoFin,
  horario: Horario | null,
): { titulo: string; descripcion: string; motivoSalida: string } {
  if (motivo === "jornada" && horario) {
    return {
      titulo: "La jornada terminó",
      descripcion: `El acceso está disponible ${textoFranjaEnFrase(horario)}. Tu sesión se cerró.`,
      motivoSalida: "La jornada terminó.",
    };
  }
  return {
    titulo: "Tu sesión venció",
    descripcion: "Iniciá sesión de nuevo para seguir.",
    motivoSalida: "Tu sesión venció.",
  };
}

export function textoAvisoSesion(sesionExpira: string, zona: string): string {
  return `Tu sesión vence a las ${horaMinuto(instanteDe(sesionExpira), zona)}.`;
}

export function textoSesionHasta(sesionExpira: string, zona: string): string {
  return `Sesión hasta las ${horaMinuto(instanteDe(sesionExpira), zona)}`;
}
