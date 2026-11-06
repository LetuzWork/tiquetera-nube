import type { Estado, Evento } from "../api/types";
import { estados } from "../theme/theme";

const ZONA = "America/Argentina/Buenos_Aires";

const corta = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const larga = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const fechaCorta = (iso: string) => corta.format(new Date(iso)).replace(",", "");

export const fechaLarga = (iso: string) => larga.format(new Date(iso));

export const hhmm = (hora: string) => hora.slice(0, 5);

export function duracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

const nombreEstado = (valor: string | null) => (valor && valor in estados ? estados[valor as Estado].etiqueta : valor ?? "—");

export function describirEvento(e: Evento): string {
  switch (e.campo) {
    case "creacion":
      return "abrió el ticket";
    case "estado":
      return `estado: ${nombreEstado(e.anterior)} → ${nombreEstado(e.nuevo)}`;
    case "responsable":
      return `responsable: ${e.anterior ?? "—"} → ${e.nuevo ?? "—"}`;
    case "comentario":
      return `comentó (${e.nuevo ?? ""})`;
    default:
      return `${e.campo}: ${e.anterior ?? "—"} → ${e.nuevo ?? "—"}`;
  }
}

export function etiquetaAccion(actual: Estado, destino: Estado): string {
  if (destino === "CERRADO") return "Archivar talón";
  if (destino === "RESUELTO") return "Marcar resuelto";
  if (actual === "ABIERTO") return "Tomar";
  if (actual === "CERRADO") return "Reabrir archivado";
  return "Reabrir";
}
