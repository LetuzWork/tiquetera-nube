import type { Filtros } from "../api/types";

export type Periodo = "7" | "30" | "90" | "todo";

export const PERIODO_INICIAL: Periodo = "30";

export const PERIODOS: readonly { valor: Periodo; etiqueta: string }[] = [
  { valor: "7", etiqueta: "7 días" },
  { valor: "30", etiqueta: "30 días" },
  { valor: "90", etiqueta: "90 días" },
  { valor: "todo", etiqueta: "Todo" },
];

export type Rango = Pick<Filtros, "desde" | "hasta">;

export interface PuntoSerie {
  clave: string;
  etiqueta: string;
  valor: number;
  fraccion: number;
}

const MS_DIA = 86_400_000;

// Aritmética en UTC sobre "AAAA-MM-DD": el día del servidor ya viene dado y no se mira la zona del dispositivo.
function msDeDia(dia: string): number {
  const [anio = 1970, mes = 1, numero = 1] = dia.split("-").map(Number);
  return Date.UTC(anio, mes - 1, numero);
}

const diaDeMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function sumarDias(dia: string, dias: number): string {
  return diaDeMs(msDeDia(dia) + dias * MS_DIA);
}

export function rangoDePeriodo(p: Periodo, hoy: string): Rango {
  if (p === "todo") return {};
  return { desde: sumarDias(hoy, -(Number(p) - 1)), hasta: hoy };
}

export function textoHoras(h: number | null): string {
  return h === null ? "Sin datos" : `${h.toFixed(1)} h`;
}

export function serie(
  conteos: Record<string, number>,
  orden?: readonly string[],
  etiquetas?: Record<string, string>,
): PuntoSerie[] {
  const claves = orden ? [...orden, ...Object.keys(conteos).filter((clave) => !orden.includes(clave))] : Object.keys(conteos);
  const valores = claves.map((clave) => conteos[clave] ?? 0);
  const maximo = Math.max(0, ...valores);
  return claves.map((clave, i) => {
    const valor = valores[i] ?? 0;
    return { clave, etiqueta: etiquetas?.[clave] ?? clave, valor, fraccion: maximo > 0 ? valor / maximo : 0 };
  });
}

export function completarDias(conteos: Record<string, number>, rango: Rango): Record<string, number> {
  const dias = Object.keys(conteos).sort();
  const desde = rango.desde ?? dias[0];
  const hasta = rango.hasta ?? dias[dias.length - 1];
  if (desde === undefined || hasta === undefined || desde > hasta) return { ...conteos };
  const completos: Record<string, number> = {};
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) completos[dia] = conteos[dia] ?? 0;
  return completos;
}
