export type Turno = "dia" | "noche";

export type Estado = "ABIERTO" | "EN_PROGRESO" | "RESUELTO" | "CERRADO";

export type Prioridad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export interface PresentacionEstado {
  etiqueta: string;
  color: string;
  tachado: boolean;
}

export interface PresentacionPrioridad {
  etiqueta: string;
  perforaciones: 1 | 2 | 3 | 4;
  resaltar: boolean;
}

export const fuentes = {
  cartel: "var(--tq-fuente-cartel)",
  texto: "var(--tq-fuente-texto)",
  numeradora: "var(--tq-fuente-numeradora)",
} as const;

export const colores = {
  papel: "var(--tq-papel)",
  papelAlto: "var(--tq-papel-alto)",
  papelHundido: "var(--tq-papel-hundido)",
  tinta: "var(--tq-tinta)",
  tintaSuave: "var(--tq-tinta-suave)",
  tintaTenue: "var(--tq-tinta-tenue)",
  linea: "var(--tq-linea)",
  perforado: "var(--tq-perforado)",
  carbonico: "var(--tq-carbonico)",
  sello: "var(--tq-sello)",
  contable: "var(--tq-contable)",
  resaltador: "var(--tq-resaltador)",
  oxido: "var(--tq-oxido)",
  sobreAcento: "var(--tq-sobre-acento)",
} as const;

export const estados: Record<Estado, PresentacionEstado> = {
  ABIERTO: { etiqueta: "Abierto", color: colores.sello, tachado: false },
  EN_PROGRESO: { etiqueta: "En progreso", color: colores.carbonico, tachado: false },
  RESUELTO: { etiqueta: "Resuelto", color: colores.contable, tachado: false },
  CERRADO: { etiqueta: "Cerrado", color: colores.tintaTenue, tachado: true },
};

export const prioridades: Record<Prioridad, PresentacionPrioridad> = {
  BAJA: { etiqueta: "Baja", perforaciones: 1, resaltar: false },
  MEDIA: { etiqueta: "Media", perforaciones: 2, resaltar: false },
  ALTA: { etiqueta: "Alta", perforaciones: 3, resaltar: false },
  CRITICA: { etiqueta: "Crítica", perforaciones: 4, resaltar: true },
};

export const formatoNumero = (id: number | string): string => {
  const numero = typeof id === "number" ? id : Number(String(id).replace(/\D/g, ""));
  return `TQ-${String(numero).padStart(6, "0")}`;
};

export const minutosAvisoCierre = 15;
