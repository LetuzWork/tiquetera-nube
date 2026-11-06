import type { ErrorCampo } from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const EVENTO_SESION_CAIDA = "tq:sesion-caida";

type Query = Record<string, string | number | undefined | null>;

export class ApiError extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly datos: Record<string, unknown>,
  ) {
    super(mensaje);
  }

  get errores(): ErrorCampo[] {
    return Array.isArray(this.datos.errores) ? (this.datos.errores as ErrorCampo[]) : [];
  }
}

export function construirUrl(ruta: string, query?: Query): string {
  const url = new URL(BASE + ruta, window.location.origin);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.pathname + url.search;
}

export async function api<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST" | "PATCH"; cuerpo?: unknown; query?: Query } = {},
): Promise<T> {
  const metodo = opciones.metodo ?? "GET";
  const conCuerpo = metodo !== "GET";
  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, opciones.query), {
      method: metodo,
      credentials: "include",
      headers: conCuerpo ? { "Content-Type": "application/json" } : undefined,
      body: conCuerpo ? JSON.stringify(opciones.cuerpo ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});
  }
  if (respuesta.status === 204) return undefined as T;
  const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!respuesta.ok) {
    const codigo = typeof datos.codigo === "string" ? datos.codigo : "ERROR";
    const detalle = typeof datos.detalle === "string" ? datos.detalle : "Ocurrió un error inesperado.";
    if (respuesta.status === 401 && ruta !== "/auth/login" && ruta !== "/auth/me") {
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA, { detail: { codigo, detalle } }));
    }
    throw new ApiError(respuesta.status, codigo, detalle, datos);
  }
  return datos as T;
}
