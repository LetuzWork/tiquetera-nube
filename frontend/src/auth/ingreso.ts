import { ApiError } from "../api/client";

export const PATRON_USUARIO = /^[A-Za-z0-9._-]{1,64}$/;

export const MS_ESPERA_INGRESO = 15_000;

export interface ResultadoIngreso {
  texto: string;
  vaciarContrasena: boolean;
  sacudir: boolean;
  enfocarContrasena: boolean;
  reconsultarFranja: boolean;
}

export function validarIngreso(usuario: string, password: string): { usuario?: string; password?: string } {
  const errores: { usuario?: string; password?: string } = {};
  const u = usuario.trim();
  if (u.includes("@") || u.includes("\\")) {
    errores.usuario = "Escribí solo tu usuario, sin el dominio.";
  } else if (!PATRON_USUARIO.test(u)) {
    errores.usuario = "Usuario inválido: solo letras sin tilde, números, punto, guion y guion bajo.";
  }
  if (password === "") errores.password = "Ingresá la contraseña.";
  return errores;
}

const SIN_ACCIONES = { vaciarContrasena: false, sacudir: false, enfocarContrasena: false, reconsultarFranja: false };

export function resultadoIngreso(error: unknown): ResultadoIngreso {
  if (!(error instanceof ApiError)) return { ...SIN_ACCIONES, texto: "Ocurrió un error inesperado. Probá de nuevo." };
  switch (error.codigo) {
    case "CREDENCIALES_INVALIDAS":
      return {
        texto: "Usuario o contraseña incorrectos.",
        vaciarContrasena: true,
        sacudir: true,
        enfocarContrasena: true,
        reconsultarFranja: false,
      };
    case "FUERA_DE_HORARIO":
      return { ...SIN_ACCIONES, texto: "No se puede ingresar fuera del horario de atención.", reconsultarFranja: true };
    case "ACCESO_BLOQUEADO":
    case "SIN_ROL":
    case "DIRECTORIO_NO_DISPONIBLE":
      return { ...SIN_ACCIONES, texto: error.message };
    case "SIN_CONEXION":
      return { ...SIN_ACCIONES, texto: "No se pudo contactar al servidor." };
    case "SIN_RESPUESTA":
      return { ...SIN_ACCIONES, texto: "El servidor no respondió. Probá de nuevo." };
    default:
      return { ...SIN_ACCIONES, texto: "Ocurrió un error inesperado. Probá de nuevo." };
  }
}

export function destinoTrasIngreso(estado: unknown): string {
  const desde = typeof estado === "object" && estado !== null ? (estado as { desde?: unknown }).desde : undefined;
  if (typeof desde === "string" && desde.startsWith("/") && !desde.startsWith("//") && desde !== "/ventanilla") return desde;
  return "/bandeja";
}
