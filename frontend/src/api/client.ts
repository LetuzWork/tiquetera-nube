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

const ESTADOS_SIN_SERVIDOR = new Set([500, 502, 503, 504]);

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});
const sinRespuesta = () => new ApiError(0, "SIN_RESPUESTA", "El servidor no respondió. Probá de nuevo.", {});

export async function api<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST" | "PATCH" | "PUT"; cuerpo?: unknown; query?: Query; senal?: AbortSignal } = {},
): Promise<T> {
  const metodo = opciones.metodo ?? "GET";
  const conCuerpo = metodo !== "GET";
  const { senal } = opciones;
  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, opciones.query), {
      method: metodo,
      credentials: "include",
      headers: conCuerpo ? { "Content-Type": "application/json" } : undefined,
      body: conCuerpo ? JSON.stringify(opciones.cuerpo ?? {}) : undefined,
      signal: senal,
    });
  } catch {
    throw senal?.aborted ? sinRespuesta() : sinConexion();
  }
  if (respuesta.status === 204) return undefined as T;
  const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  // El aborto durante la lectura del cuerpo deja datos vacíos: no puede pasar por una respuesta válida.
  if (senal?.aborted) throw sinRespuesta();
  if (!respuesta.ok) {
    // El proxy de Vite responde 500 vacío con el backend caído (D-24).
    if (ESTADOS_SIN_SERVIDOR.has(respuesta.status) && typeof datos.codigo !== "string") throw sinConexion();
    const codigo = typeof datos.codigo === "string" ? datos.codigo : "ERROR";
    const detalle = typeof datos.detalle === "string" ? datos.detalle : "Ocurrió un error inesperado.";
    if (respuesta.status === 401 && ruta !== "/auth/login" && ruta !== "/auth/me") {
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA, { detail: { codigo, detalle } }));
    }
    throw new ApiError(respuesta.status, codigo, detalle, datos);
  }
  return datos as T;
}
