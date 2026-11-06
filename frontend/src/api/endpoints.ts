import { api, construirUrl } from "./client";
import type { Estado, Filtros, Horario, Me, NuevoTicket, Pagina, Persona, Resumen, Ticket } from "./types";

type CambiosTicket = Partial<Pick<Ticket, "titulo" | "descripcion" | "categoria" | "prioridad">>;

export const auth = {
  horario: () => api<Horario>("/auth/horario"),
  login: (usuario: string, password: string) => api<Me>("/auth/login", { metodo: "POST", cuerpo: { usuario, password } }),
  logout: () => api<void>("/auth/logout", { metodo: "POST" }),
  me: () => api<Me>("/auth/me"),
};

export const tickets = {
  listar: (filtros: Filtros, pagina = 1, porPagina = 20) =>
    api<Pagina>("/tickets", { query: { ...filtros, pagina, por_pagina: porPagina } }),
  obtener: (numero: number) => api<Ticket>(`/tickets/${numero}`),
  crear: (datos: NuevoTicket) => api<Ticket>("/tickets", { metodo: "POST", cuerpo: datos }),
  editar: (numero: number, cambios: CambiosTicket) => api<Ticket>(`/tickets/${numero}`, { metodo: "PATCH", cuerpo: cambios }),
  cambiarEstado: (numero: number, estado: Estado) =>
    api<Ticket>(`/tickets/${numero}/estado`, { metodo: "POST", cuerpo: { estado } }),
  asignar: (numero: number, responsable: string | null) =>
    api<Ticket>(`/tickets/${numero}/asignacion`, { metodo: "POST", cuerpo: { responsable } }),
  comentar: (numero: number, texto: string) =>
    api<Ticket>(`/tickets/${numero}/comentarios`, { metodo: "POST", cuerpo: { texto } }),
};

export const usuarios = {
  responsables: () => api<Persona[]>("/usuarios/responsables"),
};

export const reportes = {
  resumen: (filtros: Filtros) => api<Resumen>("/reportes/resumen", { query: { ...filtros } }),
  urlExport: (archivo: "tickets" | "historial", filtros: Filtros) =>
    construirUrl(`/reportes/export/${archivo}.csv`, { ...filtros }),
};
