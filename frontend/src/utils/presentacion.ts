import type { Estado, Prioridad, Rol } from "../api/types";

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
};

export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const MARCA_PRIORIDAD: Record<Prioridad, string> = {
  BAJA: "",
  MEDIA: "!",
  ALTA: "!!",
  CRITICA: "!!!",
};

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  BAJA: "Prioridad baja",
  MEDIA: "Prioridad media",
  ALTA: "Prioridad alta",
  CRITICA: "Prioridad crítica",
};

// En puntos de código, como cuenta el backend (Pydantic), y no en unidades UTF-16.
export const largoTexto = (texto: string): number => Array.from(texto).length;

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Admin",
  operador: "Operador",
  usuario: "Usuario",
  consulta: "Consulta",
};

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);

export function iniciales(nombre: string): string {
  const palabras = nombre.split(/[\s._-]+/).filter(Boolean);
  const nombres = palabras.filter((p) => !PARTICULAS.has(p.toLowerCase()));
  const util = nombres.length > 0 ? nombres : palabras;
  if (util.length === 0) return "";
  const primera = util[0] ?? "";
  const ultima = util[util.length - 1] ?? "";
  if (util.length === 1) return Array.from(primera).slice(0, 2).join("").toUpperCase();
  return (Array.from(primera).slice(0, 1).join("") + Array.from(ultima).slice(0, 1).join("")).toUpperCase();
}
