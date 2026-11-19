import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { MS_ESPERA_INGRESO, PATRON_USUARIO, destinoTrasIngreso, resultadoIngreso, validarIngreso } from "./ingreso";

const SIN_DOMINIO = "Escribí solo tu usuario, sin el dominio.";
const INVALIDO = "Usuario inválido: solo letras sin tilde, números, punto, guion y guion bajo.";
const SIN_CLAVE = "Ingresá la contraseña.";

describe("constantes", () => {
  it("la espera es de 15 s y el patrón es el del backend", () => {
    expect(MS_ESPERA_INGRESO).toBe(15_000);
    expect(PATRON_USUARIO.test("u.operador_1-a")).toBe(true);
  });
});

describe("validarIngreso", () => {
  it("un usuario válido y una contraseña no dan errores", () => {
    expect(validarIngreso("u.operador", "x")).toEqual({});
  });

  it("con arroba o barra invertida pide solo el usuario", () => {
    expect(validarIngreso("u.operador@dominio", "x")).toEqual({ usuario: SIN_DOMINIO });
    expect(validarIngreso("DOM\\u", "x")).toEqual({ usuario: SIN_DOMINIO });
  });

  it("vacío es inválido", () => {
    expect(validarIngreso("", "x")).toEqual({ usuario: INVALIDO });
    expect(validarIngreso("   ", "x")).toEqual({ usuario: INVALIDO });
  });

  it("65 caracteres es inválido y 64 no", () => {
    expect(validarIngreso("a".repeat(65), "x")).toEqual({ usuario: INVALIDO });
    expect(validarIngreso("a".repeat(64), "x")).toEqual({});
  });

  it("una tilde es inválida", () => {
    expect(validarIngreso("peña", "x")).toEqual({ usuario: INVALIDO });
  });

  it("recorta los espacios del usuario antes de validar", () => {
    expect(validarIngreso(" u.operador ", "x")).toEqual({});
  });

  it("la contraseña vacía pide la contraseña", () => {
    expect(validarIngreso("u.operador", "")).toEqual({ password: SIN_CLAVE });
  });

  it("los dos errores juntos", () => {
    expect(validarIngreso("", "")).toEqual({ usuario: INVALIDO, password: SIN_CLAVE });
  });
});

describe("resultadoIngreso", () => {
  const error = (codigo: string, mensaje = "detalle del servidor", estado = 400) => new ApiError(estado, codigo, mensaje, {});
  const sinAcciones = { vaciarContrasena: false, sacudir: false, enfocarContrasena: false, reconsultarFranja: false };

  it("CREDENCIALES_INVALIDAS vacía, sacude y enfoca", () => {
    expect(resultadoIngreso(error("CREDENCIALES_INVALIDAS", "x", 401))).toEqual({
      texto: "Usuario o contraseña incorrectos.",
      vaciarContrasena: true,
      sacudir: true,
      enfocarContrasena: true,
      reconsultarFranja: false,
    });
  });

  it("FUERA_DE_HORARIO reconsulta la franja", () => {
    expect(resultadoIngreso(error("FUERA_DE_HORARIO", "x", 403))).toEqual({
      ...sinAcciones,
      texto: "No se puede ingresar fuera del horario de atención.",
      reconsultarFranja: true,
    });
  });

  it.each(["ACCESO_BLOQUEADO", "SIN_ROL", "DIRECTORIO_NO_DISPONIBLE"])("%s muestra el detalle del servidor", (codigo) => {
    expect(resultadoIngreso(error(codigo, "Demasiados intentos. Esperá 5 minutos."))).toEqual({
      ...sinAcciones,
      texto: "Demasiados intentos. Esperá 5 minutos.",
    });
  });

  it("SIN_CONEXION", () => {
    expect(resultadoIngreso(new ApiError(0, "SIN_CONEXION", "otro texto", {}))).toEqual({
      ...sinAcciones,
      texto: "No se pudo contactar al servidor.",
    });
  });

  it("SIN_RESPUESTA", () => {
    expect(resultadoIngreso(new ApiError(0, "SIN_RESPUESTA", "otro texto", {}))).toEqual({
      ...sinAcciones,
      texto: "El servidor no respondió. Probá de nuevo.",
    });
  });

  it("cualquier otro código o un error que no es ApiError", () => {
    const inesperado = { ...sinAcciones, texto: "Ocurrió un error inesperado. Probá de nuevo." };
    expect(resultadoIngreso(error("ENTRADA_INVALIDA", "x", 422))).toEqual(inesperado);
    expect(resultadoIngreso(new Error("boom"))).toEqual(inesperado);
    expect(resultadoIngreso(undefined)).toEqual(inesperado);
  });
});

describe("destinoTrasIngreso", () => {
  it("vuelve a la ruta de la que venía", () => {
    expect(destinoTrasIngreso({ desde: "/reportes" })).toBe("/reportes");
  });

  it("descarta una ruta que empieza con //", () => {
    expect(destinoTrasIngreso({ desde: "//x" })).toBe("/bandeja");
  });

  it("descarta /ventanilla", () => {
    expect(destinoTrasIngreso({ desde: "/ventanilla" })).toBe("/bandeja");
  });

  it("sin estado, o con un estado ajeno, va a /bandeja", () => {
    expect(destinoTrasIngreso(null)).toBe("/bandeja");
    expect(destinoTrasIngreso(undefined)).toBe("/bandeja");
    expect(destinoTrasIngreso({})).toBe("/bandeja");
    expect(destinoTrasIngreso({ desde: 5 })).toBe("/bandeja");
    expect(destinoTrasIngreso({ desde: "reportes" })).toBe("/bandeja");
    expect(destinoTrasIngreso("/reportes")).toBe("/bandeja");
  });
});
