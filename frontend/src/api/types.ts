import type { Estado, Prioridad } from "../theme/theme";

export type { Estado, Prioridad };

export type Rol = "admin" | "operador" | "usuario" | "consulta";

export type Categoria = "Hardware" | "Software" | "Red" | "Accesos" | "Otro";

export const CATEGORIAS: Categoria[] = ["Hardware", "Software", "Red", "Accesos", "Otro"];
export const ESTADOS: Estado[] = ["ABIERTO", "EN_PROGRESO", "RESUELTO", "CERRADO"];
export const PRIORIDADES: Prioridad[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

export type Permiso =
  | "ticket:crear"
  | "ticket:ver_propios"
  | "ticket:ver_todos"
  | "ticket:editar"
  | "ticket:cambiar_estado"
  | "ticket:asignar"
  | "ticket:comentar"
  | "ticket:reabrir_cerrado"
  | "reporte:ver"
  | "reporte:exportar";

export interface Me {
  usuario: string;
  nombre: string;
  mail: string | null;
  rol: Rol;
  permisos: Permiso[];
  sesion_expira: string;
  segundos_restantes: number;
}

export interface Horario {
  abierto: boolean;
  ahora: string;
  inicio: string;
  fin: string;
  dias: number[];
  zona: string;
  cierre: string | null;
  proxima_apertura: string | null;
}

export interface Comentario {
  autor: string;
  texto: string;
  creado_en: string;
}

export interface Evento {
  campo: string;
  anterior: string | null;
  nuevo: string | null;
  autor: string;
  fecha: string;
}

interface TicketBase {
  id: string;
  numero: number;
  titulo: string;
  categoria: Categoria;
  estado: Estado;
  prioridad: Prioridad;
  solicitante: string;
  responsable: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface TicketResumen extends TicketBase {
  comentarios: number;
}

export interface Ticket extends TicketBase {
  descripcion: string;
  comentarios: Comentario[];
  historial: Evento[];
  acciones: Estado[];
}

export interface Pagina {
  items: TicketResumen[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface Persona {
  usuario: string;
  nombre: string;
}

export interface Resumen {
  total: number;
  pendientes: number;
  criticos_activos: number;
  horas_promedio_resolucion: number | null;
  por_estado: Record<string, number>;
  por_prioridad: Record<string, number>;
  por_categoria: Record<string, number>;
  por_responsable: Record<string, number>;
  por_dia: Record<string, number>;
}

export interface Filtros {
  estado?: Estado | "";
  prioridad?: Prioridad | "";
  categoria?: Categoria | "";
  responsable?: string;
  q?: string;
  desde?: string;
  hasta?: string;
}

export interface NuevoTicket {
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  prioridad: Prioridad;
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}
