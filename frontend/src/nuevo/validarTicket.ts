import { largoTexto } from "../utils/presentacion";

export const TITULO_MIN = 5;
export const TITULO_MAX = 120;
export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 5000;

export interface ErroresTicket {
  titulo?: string;
  descripcion?: string;
}

export function validarTicket(titulo: string, descripcion: string): ErroresTicket {
  const errores: ErroresTicket = {};
  const largoTitulo = largoTexto(titulo.trim());
  const largoDescripcion = largoTexto(descripcion.trim());
  if (largoTitulo < TITULO_MIN) errores.titulo = "El título necesita al menos 5 caracteres.";
  else if (largoTitulo > TITULO_MAX) errores.titulo = "El título admite hasta 120 caracteres.";
  if (largoDescripcion < DESCRIPCION_MIN) errores.descripcion = "Contá el problema en al menos 10 caracteres.";
  else if (largoDescripcion > DESCRIPCION_MAX) errores.descripcion = "La descripción admite hasta 5000 caracteres.";
  return errores;
}
