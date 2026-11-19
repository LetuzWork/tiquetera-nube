import { CATEGORIAS, ESTADOS, PRIORIDADES } from "../api/types";
import type { Categoria, Estado, Filtros, Prioridad, TicketResumen } from "../api/types";
import { horaOFecha, instanteDe, partesEnZona } from "../utils/zona";

export const POR_PAGINA = 25;

export interface VistaBandeja {
  q: string;
  estado: Estado | null;
  prioridad: Prioridad | null;
  categoria: Categoria | null;
  mios: boolean;
  pagina: number;
}

export const VISTA_INICIAL: VistaBandeja = {
  q: "",
  estado: null,
  prioridad: null,
  categoria: null,
  mios: false,
  pagina: 1,
};

export const ETIQUETA_ESTADO_FILTRO: Record<Estado, string> = {
  ABIERTO: "Abiertos",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resueltos",
  CERRADO: "Cerrados",
};

export type NombreGrupo = "Hoy" | "Anteriores";

export interface GrupoBandeja {
  nombre: NombreGrupo;
  items: TicketResumen[];
}

function elegido<T extends string>(valor: string | null, permitidos: readonly T[]): T | null {
  return permitidos.find((permitido) => permitido === valor) ?? null;
}

function paginaDe(valor: string | null): number {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : 1;
}

export function vistaDesdeParams(p: URLSearchParams): VistaBandeja {
  return {
    q: p.get("q") ?? "",
    estado: elegido(p.get("estado"), ESTADOS),
    prioridad: elegido(p.get("prioridad"), PRIORIDADES),
    categoria: elegido(p.get("categoria"), CATEGORIAS),
    mios: p.get("mios") === "1",
    pagina: paginaDe(p.get("pagina")),
  };
}

export function paramsDeVista(v: VistaBandeja): URLSearchParams {
  const p = new URLSearchParams();
  if (v.q.trim() !== "") p.set("q", v.q);
  if (v.estado !== null) p.set("estado", v.estado);
  if (v.prioridad !== null) p.set("prioridad", v.prioridad);
  if (v.categoria !== null) p.set("categoria", v.categoria);
  if (v.mios) p.set("mios", "1");
  if (v.pagina > 1) p.set("pagina", String(v.pagina));
  return p;
}

export function filtrosDeVista(v: VistaBandeja, usuario: string): Filtros {
  const filtros: Filtros = {};
  const q = v.q.trim();
  if (q !== "") filtros.q = q;
  if (v.estado !== null) filtros.estado = v.estado;
  if (v.prioridad !== null) filtros.prioridad = v.prioridad;
  if (v.categoria !== null) filtros.categoria = v.categoria;
  if (v.mios) filtros.responsable = usuario;
  return filtros;
}

export function cantidadFiltros(v: VistaBandeja): number {
  return (v.prioridad !== null ? 1 : 0) + (v.categoria !== null ? 1 : 0) + (v.mios ? 1 : 0);
}

export function hayFiltros(v: VistaBandeja): boolean {
  return v.q.trim() !== "" || v.estado !== null || cantidadFiltros(v) > 0;
}

export function textoResumen(items: TicketResumen[] | null, total: number | null): string | null {
  if (items === null) return null;
  const entraron = total ?? items.length;
  if (entraron === 0) return "Hoy no entró ningún ticket.";
  const sinTomar = items.filter((t) => t.estado === "ABIERTO" && t.responsable === null).length;
  const entrada = entraron === 1 ? "1 entró hoy" : `${entraron} entraron hoy`;
  if (sinTomar === 0) return `${entrada} y ninguno sigue sin tomar.`;
  return sinTomar === 1 ? `${entrada} y 1 sigue sin tomar.` : `${entrada} y ${sinTomar} siguen sin tomar.`;
}

export function esDeHoy(creadoEn: string, zona: string, hoy: string): boolean {
  return partesEnZona(instanteDe(creadoEn), zona).fecha === hoy;
}

export function agrupar(items: TicketResumen[], zona: string, hoy: string): GrupoBandeja[] {
  const grupos: GrupoBandeja[] = [
    { nombre: "Hoy", items: [] },
    { nombre: "Anteriores", items: [] },
  ];
  for (const ticket of items) grupos[esDeHoy(ticket.creado_en, zona, hoy) ? 0 : 1]?.items.push(ticket);
  return grupos.filter((grupo) => grupo.items.length > 0);
}

export function cuandoFila(creadoEn: string, zona: string, hoy: string): string {
  return horaOFecha(instanteDe(creadoEn), zona, hoy);
}

export function detalleFila(t: Pick<TicketResumen, "id" | "categoria" | "solicitante">): string {
  return `${t.id} ${t.categoria}, lo pidió ${t.solicitante}`;
}

export function ultimaPagina(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

export function textoPie(pagina: number, porPagina: number, total: number): string {
  if (total <= 0) return "0 de 0";
  const actual = Math.min(Math.max(1, pagina), ultimaPagina(total, porPagina));
  const desde = (actual - 1) * porPagina + 1;
  const hasta = Math.min(actual * porPagina, total);
  return `${desde}–${hasta} de ${total}`;
}
