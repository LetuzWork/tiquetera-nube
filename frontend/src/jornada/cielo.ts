import type { Horario } from "../api/types";
import { segundosDe } from "../utils/zona";
import type { Jornada } from "./jornada";

export interface PuntoCielo {
  minuto: number;
  arriba: string;
  abajo: string;
}

export type Tinta = "#14233c" | "#ffffff";

export interface ColoresCielo {
  arriba: string;
  abajo: string;
  tinta: Tinta;
}

type Canales = readonly [number, number, number];

const TINTA_OSCURA: Tinta = "#14233c";
const TINTA_BLANCA: Tinta = "#ffffff";

const MINUTO_INICIO_TABLA = 480;
const MINUTO_FIN_TABLA = 1080;

export const MINUTO_RESPALDO = 780;
export const MUESTRAS_DEGRADADO = 101;

export const PUNTOS_CIELO: PuntoCielo[] = [
  { minuto: 360, arriba: "#0f1330", abajo: "#1f2550" },
  { minuto: 450, arriba: "#27305e", abajo: "#6b5b8c" },
  { minuto: 480, arriba: "#4c659f", abajo: "#89706c" },
  { minuto: 480, arriba: "#6788d6", abajo: "#c6a39d" },
  { minuto: 495, arriba: "#678acf", abajo: "#f3c7a5" },
  { minuto: 600, arriba: "#6fa8ef", abajo: "#d9ebff" },
  { minuto: 780, arriba: "#4f98f0", abajo: "#e3f0ff" },
  { minuto: 930, arriba: "#79a9e6", abajo: "#fbe2c2" },
  { minuto: 1035, arriba: "#8682ca", abajo: "#f7ad7c" },
  { minuto: 1080, arriba: "#7980f8", abajo: "#c37781" },
  { minuto: 1080, arriba: "#36396f", abajo: "#a3646c" },
  { minuto: 1140, arriba: "#12162f", abajo: "#242a4f" },
];

function canalesDe(hex: string): Canales {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Canales;
}

function hexDe(canales: Canales): string {
  return `#${canales.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function luminancia([r, g, b]: Canales): number {
  const lineal = (c: number) => {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

export function contraste(a: string | Canales, b: string | Canales): number {
  const la = luminancia(typeof a === "string" ? canalesDe(a) : a);
  const lb = luminancia(typeof b === "string" ? canalesDe(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function puntosParaFranja(puntos: PuntoCielo[], inicio: number, fin: number): PuntoCielo[] {
  const escala = (fin - inicio) / (MINUTO_FIN_TABLA - MINUTO_INICIO_TABLA);
  return puntos.map((p) => {
    if (p.minuto < MINUTO_INICIO_TABLA) return { ...p, minuto: p.minuto + (inicio - MINUTO_INICIO_TABLA) };
    if (p.minuto <= MINUTO_FIN_TABLA) return { ...p, minuto: inicio + (p.minuto - MINUTO_INICIO_TABLA) * escala };
    return { ...p, minuto: p.minuto + (fin - MINUTO_FIN_TABLA) };
  });
}

export function colorEnMinuto(puntos: PuntoCielo[], minuto: number): { arriba: string; abajo: string } {
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  if (primero === undefined || ultimo === undefined) throw new Error("La paleta del cielo no puede estar vacía.");
  if (minuto < primero.minuto) return { arriba: primero.arriba, abajo: primero.abajo };
  if (minuto >= ultimo.minuto) return { arriba: ultimo.arriba, abajo: ultimo.abajo };
  let i = 0;
  while (puntos[i + 1] !== undefined && (puntos[i + 1] as PuntoCielo).minuto <= minuto) i++;
  const desde = puntos[i] as PuntoCielo;
  const hasta = puntos[i + 1] as PuntoCielo;
  const t = (minuto - desde.minuto) / (hasta.minuto - desde.minuto);
  const mezcla = (a: string, b: string) => {
    const ca = canalesDe(a);
    const cb = canalesDe(b);
    return hexDe([0, 1, 2].map((k) => (ca[k] as number) + ((cb[k] as number) - (ca[k] as number)) * t) as unknown as Canales);
  };
  return { arriba: mezcla(desde.arriba, hasta.arriba), abajo: mezcla(desde.abajo, hasta.abajo) };
}

export function contrasteEnDegradado(arriba: string, abajo: string, tinta: Tinta): number {
  const ca = canalesDe(arriba);
  const cb = canalesDe(abajo);
  let minimo = Infinity;
  for (let i = 0; i < MUESTRAS_DEGRADADO; i++) {
    const s = i / (MUESTRAS_DEGRADADO - 1);
    const color = [0, 1, 2].map((k) => (ca[k] as number) + ((cb[k] as number) - (ca[k] as number)) * s) as unknown as Canales;
    minimo = Math.min(minimo, contraste(tinta, color));
  }
  return minimo;
}

export function tintaSobre(arriba: string, abajo: string): Tinta {
  const oscura = contrasteEnDegradado(arriba, abajo, TINTA_OSCURA);
  const blanca = contrasteEnDegradado(arriba, abajo, TINTA_BLANCA);
  return oscura >= blanca ? TINTA_OSCURA : TINTA_BLANCA;
}

function conTinta(c: { arriba: string; abajo: string }): ColoresCielo {
  return { ...c, tinta: tintaSobre(c.arriba, c.abajo) };
}

export function cieloDe(horario: Horario | null, jornada: Jornada | null, sinFranja: boolean): ColoresCielo | null {
  if (sinFranja) return conTinta(colorEnMinuto(PUNTOS_CIELO, MINUTO_RESPALDO));
  if (horario === null || jornada === null) return null;
  if (!jornada.diaHabil) {
    const ultimo = PUNTOS_CIELO[PUNTOS_CIELO.length - 1] as PuntoCielo;
    return conTinta({ arriba: ultimo.arriba, abajo: ultimo.abajo });
  }
  const puntos = puntosParaFranja(PUNTOS_CIELO, segundosDe(horario.inicio) / 60, segundosDe(horario.fin) / 60);
  return conTinta(colorEnMinuto(puntos, jornada.minutoDelDia));
}
