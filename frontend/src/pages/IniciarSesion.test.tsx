import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, EVENTO_SESION_CAIDA } from "../api/client";
import { auth } from "../api/endpoints";
import type { Horario, Me } from "../api/types";
import { horarioDe, meDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";
import { avanzar, horarioQueAvanza, relojFalso, type RelojFalso } from "../test/tiempo";

const MARTES_0800 = "2026-11-17T11:00:00Z";
const MARTES_1420 = "2026-11-17T17:20:00Z";
const MARTES_1820 = "2026-11-17T21:20:00Z";
const MARTES_1930 = "2026-11-17T22:30:00Z";
const SABADO_1000 = "2026-11-14T13:00:00Z";
const LUNES_0800 = "2026-11-16T08:00:00-03:00";

const HORA = /^\d{2}:\d{2}$/;
const FRANJA = "Podés ingresar de lunes a viernes, de 08:00 a 18:00.";
const FUERA = "Fuera del horario de atención";
const PROXIMA = "Próxima apertura: lunes 16 de noviembre, 08:00.";
const SIN_FRANJA = "No se pudo consultar el horario.";
const VERIFICANDO = "Verificando tu sesión…";
const SIN_DOMINIO = "Escribí solo tu usuario, sin el dominio.";
const INVALIDO = "Usuario inválido: solo letras sin tilde, números, punto, guion y guion bajo.";
const SIN_CLAVE = "Ingresá la contraseña.";
const INCORRECTOS = "Usuario o contraseña incorrectos.";
const SIN_RESPUESTA = "El servidor no respondió. Probá de nuevo.";

const credencialesInvalidas = () => new ApiError(401, "CREDENCIALES_INVALIDAS", "Usuario o contraseña incorrectos.", {});
const fueraDeHorario = () =>
  new ApiError(403, "FUERA_DE_HORARIO", "Ventanilla cerrada: el acceso está fuera del horario permitido.", {
    apertura: "2026-11-16T08:00:00-03:00",
  });

interface Opciones {
  ruta?: string;
  ahora?: string;
  franja?: Partial<Horario> | "falla" | "pendiente";
  me?: Me | null | "pendiente";
  reloj?: RelojFalso;
}

async function montar({ ruta = "/ventanilla", ahora = MARTES_1420, franja = {}, me = null, reloj = relojFalso() }: Opciones = {}) {
  if (me === "pendiente") vi.spyOn(auth, "me").mockReturnValue(new Promise<Me>(() => undefined));
  if (franja === "pendiente") vi.spyOn(auth, "horario").mockReturnValue(new Promise<Horario>(() => undefined));
  const horario = franja === "falla" ? null : franja === "pendiente" ? undefined : horarioDe(ahora, franja);
  const app = await renderizarApp({ ruta, me: me === "pendiente" ? null : me, horario, reloj });
  return { ...app, persona: userEvent.setup() };
}

const pantalla = () => {
  const elemento = document.querySelector<HTMLElement>('[data-pantalla="ingreso"]');
  if (!elemento) throw new Error("No está la pantalla de inicio de sesión");
  return elemento;
};
const variable = (nombre: string) => pantalla().style.getPropertyValue(nombre);
const vidrio = () => screen.getByRole("main");
const cabecera = () => screen.getByRole("banner");
const formulario = () => screen.getByRole("form", { name: "Iniciar sesión" });
const grupo = () => screen.getByRole("group", { name: "Cuenta de dominio" });
const campoUsuario = () => screen.getByRole("textbox", { name: "Usuario" });
const campoContrasena = () => screen.getByLabelText("Contraseña");
const botonIngresar = () => screen.getByRole("button", { name: "Iniciar sesión" });
const alerta = () => screen.getByRole("alert");

async function completar(persona: UserEvent, usuario = "u.operador", contrasena = "secreta") {
  if (usuario) await persona.type(campoUsuario(), usuario);
  if (contrasena) await persona.type(campoContrasena(), contrasena);
}

async function ingresar(persona: UserEvent, usuario?: string, contrasena?: string) {
  await completar(persona, usuario, contrasena);
  await persona.click(botonIngresar());
}

async function esperarAlerta(texto: string) {
  await waitFor(() => expect(alerta().textContent).toBe(texto));
}

function enOrden(...elementos: HTMLElement[]) {
  elementos.slice(1).forEach((elemento, i) => {
    const previo = elementos[i];
    if (!previo) throw new Error("Falta un elemento");
    expect(previo.compareDocumentPosition(elemento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
}

describe("IniciarSesion", () => {
  describe("RF-25: la pantalla sobre el cielo", () => {
    it("muestra el logo, el reloj, la franja, los encabezados, los campos y el botón", async () => {
      await montar();
      expect(within(cabecera()).getByText("Tiquetera Nube")).toBeInTheDocument();
      expect(within(cabecera()).getByText("14:20")).toBeInTheDocument();
      expect(within(cabecera()).getByText(FRANJA)).toBeInTheDocument();
      expect(within(vidrio()).getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeInTheDocument();
      expect(within(vidrio()).getByText("Usá tu cuenta de dominio")).toBeInTheDocument();
      expect(within(vidrio()).getByRole("form", { name: "Iniciar sesión" })).toBeInTheDocument();
      expect(grupo()).toContainElement(campoUsuario());
      expect(grupo()).toContainElement(campoContrasena());
      expect(screen.getByText("Cuenta de dominio")).toHaveAttribute("data-oculta", "true");
      expect(within(formulario()).getByRole("button", { name: "Iniciar sesión" })).toHaveAttribute("type", "submit");
      expect(botonIngresar()).toBeEnabled();
      expect(screen.queryByText(FUERA)).not.toBeInTheDocument();
      expect(screen.queryByText(SIN_FRANJA)).not.toBeInTheDocument();
      expect(alerta()).toBeEmptyDOMElement();
    });

    it("pone el foco en 'Usuario' al abrir", async () => {
      await montar();
      expect(campoUsuario()).toHaveFocus();
    });

    it("los campos piden lo del plan: usuario sin maxLength, contraseña de hasta 256", async () => {
      await montar();
      expect(campoUsuario()).toHaveAttribute("autocomplete", "username");
      expect(campoUsuario()).not.toHaveAttribute("maxlength");
      expect(campoContrasena()).toHaveAttribute("type", "password");
      expect(campoContrasena()).toHaveAttribute("autocomplete", "current-password");
      expect(campoContrasena()).toHaveAttribute("maxlength", "256");
    });

    it("el vidrio es el angosto", async () => {
      await montar();
      expect(vidrio()).toHaveAttribute("data-variante", "angosta");
      expect(pantalla()).toContainElement(vidrio());
    });

    it("a las 08:00 usa el cielo de la tabla con la tinta #14233c, sin horizonte", async () => {
      await montar({ ahora: MARTES_0800 });
      expect(variable("--tq-cielo-arriba")).toBe("#6788d6");
      expect(variable("--tq-cielo-abajo")).toBe("#c6a39d");
      expect(variable("--tq-cielo-tinta")).toBe("#14233c");
      expect(pantalla()).toHaveAttribute("data-tinta", "#14233c");
      expect(within(cabecera()).getByText("08:00")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: /^Jornada de/ })).not.toBeInTheDocument();
    });

    it("a las 18:20 usa el cielo de la tabla con la tinta #ffffff", async () => {
      await montar({ ahora: MARTES_1820 });
      expect(variable("--tq-cielo-arriba")).toBe("#2a2d5a");
      expect(variable("--tq-cielo-abajo")).toBe("#795162");
      expect(variable("--tq-cielo-tinta")).toBe("#ffffff");
      expect(pantalla()).toHaveAttribute("data-tinta", "#ffffff");
    });

    it("D-25: mientras la franja no llegó, fondo liso sin reloj y el formulario disponible", async () => {
      await montar({ franja: "pendiente" });
      expect(pantalla()).not.toHaveAttribute("data-tinta");
      expect(variable("--tq-cielo-arriba")).toBe("");
      expect(screen.queryByText(HORA)).not.toBeInTheDocument();
      expect(screen.queryByText(FRANJA)).not.toBeInTheDocument();
      expect(screen.queryByText(SIN_FRANJA)).not.toBeInTheDocument();
      expect(campoUsuario()).toBeEnabled();
      expect(campoContrasena()).toBeEnabled();
      expect(botonIngresar()).toBeEnabled();
    });
  });

  describe("RF-26: validación antes de pedir nada", () => {
    it("con '@', el error va debajo de 'Usuario' con el foco ahí y no se pide nada", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await ingresar(persona, "u.operador@dominio");
      expect(campoUsuario()).toHaveAccessibleDescription(SIN_DOMINIO);
      expect(campoUsuario()).toHaveAttribute("aria-invalid", "true");
      expect(campoUsuario()).toHaveFocus();
      expect(campoContrasena()).not.toHaveAttribute("aria-invalid");
      expect(login).not.toHaveBeenCalled();
      expect(alerta()).toBeEmptyDOMElement();
      expect(botonIngresar()).toBeEnabled();
    });

    it("con '\\', el mismo aviso del dominio", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await ingresar(persona, "DOM\\u");
      expect(campoUsuario()).toHaveAccessibleDescription(SIN_DOMINIO);
      expect(login).not.toHaveBeenCalled();
    });

    it("vacío: los dos errores, cada uno en su campo, y el foco en el primero", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await persona.click(botonIngresar());
      expect(campoUsuario()).toHaveAccessibleDescription(INVALIDO);
      expect(campoContrasena()).toHaveAccessibleDescription(SIN_CLAVE);
      expect(campoContrasena()).toHaveAttribute("aria-invalid", "true");
      expect(campoUsuario()).toHaveFocus();
      expect(login).not.toHaveBeenCalled();
    });

    it("D-15: 65 caracteres pegados no se recortan y dan usuario inválido", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await persona.click(campoUsuario());
      await persona.paste("a".repeat(65));
      await ingresar(persona, "");
      expect(campoUsuario()).toHaveValue("a".repeat(65));
      expect(campoUsuario()).toHaveAccessibleDescription(INVALIDO);
      expect(login).not.toHaveBeenCalled();
    });

    it("con una tilde es inválido", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await ingresar(persona, "peña");
      expect(campoUsuario()).toHaveAccessibleDescription(INVALIDO);
      expect(login).not.toHaveBeenCalled();
    });

    it("si solo falta la contraseña, el foco va a 'Contraseña'", async () => {
      const login = vi.spyOn(auth, "login");
      const { persona } = await montar();
      await ingresar(persona, "u.operador", "");
      expect(campoContrasena()).toHaveAccessibleDescription(SIN_CLAVE);
      expect(campoUsuario()).not.toHaveAttribute("aria-invalid");
      expect(campoContrasena()).toHaveFocus();
      expect(login).not.toHaveBeenCalled();
    });

    it("recorta los espacios del usuario y manda la señal de espera; al corregir, los errores se van", async () => {
      const login = vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      const { persona } = await montar();
      await persona.click(botonIngresar());
      expect(campoUsuario()).toHaveAccessibleDescription(INVALIDO);
      await ingresar(persona, " u.operador ");
      expect(login).toHaveBeenCalledTimes(1);
      expect(login).toHaveBeenCalledWith("u.operador", "secreta", expect.any(AbortSignal));
      await esperarAlerta(INCORRECTOS);
      expect(campoUsuario()).not.toHaveAttribute("aria-invalid");
      expect(campoUsuario()).not.toHaveAccessibleDescription();
    });
  });

  describe("RF-27: mientras se verifica", () => {
    it("el botón dice 'Iniciando sesión…', está deshabilitado y no se puede enviar de nuevo", async () => {
      const login = vi.spyOn(auth, "login").mockReturnValue(new Promise<Me>(() => undefined));
      const { persona } = await montar();
      await ingresar(persona);
      const cargando = screen.getByRole("button", { name: "Iniciando sesión…" });
      expect(cargando).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
      await persona.click(cargando);
      await persona.type(campoContrasena(), "{Enter}");
      expect(login).toHaveBeenCalledTimes(1);
    });

    it("a los 15 s sin respuesta, 'El servidor no respondió. Probá de nuevo.' y el botón vuelve", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const reloj = relojFalso();
      const pedido = vi.spyOn(globalThis, "fetch").mockImplementation(
        (_url, opciones) =>
          new Promise<Response>((_resolver, rechazar) => {
            opciones?.signal?.addEventListener("abort", () => rechazar(new DOMException("Abortado", "AbortError")));
          }),
      );
      await montar({ reloj });
      const persona = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      await ingresar(persona);
      expect(screen.getByRole("button", { name: "Iniciando sesión…" })).toBeDisabled();
      await avanzar(14_000, reloj);
      expect(screen.getByRole("button", { name: "Iniciando sesión…" })).toBeDisabled();
      expect(alerta()).toBeEmptyDOMElement();
      await avanzar(1_000, reloj);
      expect(alerta().textContent).toBe(SIN_RESPUESTA);
      expect(botonIngresar()).toBeEnabled();
      expect(pedido).toHaveBeenCalledTimes(1);
      expect(pedido.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(campoContrasena()).toHaveValue("secreta");
    });

    it("una respuesta antes de los 15 s cancela la espera", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const reloj = relojFalso();
      const login = vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      await montar({ reloj });
      const persona = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      await ingresar(persona);
      await esperarAlerta(INCORRECTOS);
      await avanzar(20_000, reloj);
      expect(login.mock.calls[0]?.[2]?.aborted).toBe(false);
      expect(alerta().textContent).toBe(INCORRECTOS);
    });
  });

  describe("RF-28: credenciales rechazadas", () => {
    it("muestra el mensaje, sacude el grupo, vacía la contraseña y la enfoca", async () => {
      vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      const { persona } = await montar();
      expect(grupo()).toHaveAttribute("data-sacudir", "false");
      await ingresar(persona, "u.operador", "mala");
      await esperarAlerta(INCORRECTOS);
      expect(grupo()).toHaveAttribute("data-sacudir", "true");
      expect(campoContrasena()).toHaveValue("");
      expect(campoContrasena()).toHaveFocus();
      expect(campoUsuario()).toHaveValue("u.operador");
      expect(botonIngresar()).toBeEnabled();
    });

    it("cada rechazo vuelve a sacudir", async () => {
      vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      const { persona } = await montar();
      await ingresar(persona, "u.operador", "mala");
      await esperarAlerta(INCORRECTOS);
      const primera = grupo().getAttribute("data-vuelta");
      await persona.type(campoContrasena(), "otra");
      await persona.click(botonIngresar());
      await waitFor(() => expect(grupo().getAttribute("data-vuelta")).not.toBe(primera));
      expect(grupo()).toHaveAttribute("data-sacudir", "true");
      expect(alerta().textContent).toBe(INCORRECTOS);
    });
  });

  describe("RF-29: un mensaje por cada rechazo", () => {
    const casos: { caso: string; error: unknown; texto: string; reconsulta: boolean }[] = [
      { caso: "FUERA_DE_HORARIO", error: fueraDeHorario(), texto: "No se puede ingresar fuera del horario de atención.", reconsulta: true },
      {
        caso: "ACCESO_BLOQUEADO",
        error: new ApiError(429, "ACCESO_BLOQUEADO", "Demasiados intentos fallidos. Probá de nuevo más tarde.", {}),
        texto: "Demasiados intentos fallidos. Probá de nuevo más tarde.",
        reconsulta: false,
      },
      {
        caso: "SIN_ROL",
        error: new ApiError(403, "SIN_ROL", "Tu cuenta no pertenece a ningún grupo habilitado para la Tiquetera.", {}),
        texto: "Tu cuenta no pertenece a ningún grupo habilitado para la Tiquetera.",
        reconsulta: false,
      },
      {
        caso: "DIRECTORIO_NO_DISPONIBLE",
        error: new ApiError(503, "DIRECTORIO_NO_DISPONIBLE", "No se pudo contactar al directorio. Intentá nuevamente.", {}),
        texto: "No se pudo contactar al directorio. Intentá nuevamente.",
        reconsulta: false,
      },
      {
        caso: "SIN_CONEXION",
        error: new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {}),
        texto: "No se pudo contactar al servidor.",
        reconsulta: false,
      },
      {
        caso: "ENTRADA_INVALIDA",
        error: new ApiError(422, "ENTRADA_INVALIDA", "Revisá los datos enviados.", {}),
        texto: "Ocurrió un error inesperado. Probá de nuevo.",
        reconsulta: false,
      },
      { caso: "un error que no es ApiError", error: new TypeError("x"), texto: "Ocurrió un error inesperado. Probá de nuevo.", reconsulta: false },
    ];

    it.each(casos)("$caso → el texto que corresponde, sin sacudir ni vaciar", async ({ error, texto, reconsulta }) => {
      vi.spyOn(auth, "login").mockRejectedValue(error);
      const { persona } = await montar();
      const horario = vi.mocked(auth.horario);
      expect(horario).toHaveBeenCalledTimes(1);
      await ingresar(persona);
      await esperarAlerta(texto);
      expect(grupo()).toHaveAttribute("data-sacudir", "false");
      expect(campoContrasena()).toHaveValue("secreta");
      expect(botonIngresar()).toBeEnabled();
      await waitFor(() => expect(horario).toHaveBeenCalledTimes(reconsulta ? 2 : 1));
    });

    it("sin red, por el camino real del cliente: 'No se pudo contactar al servidor.'", async () => {
      const { persona } = await montar();
      await ingresar(persona);
      await esperarAlerta("No se pudo contactar al servidor.");
    });
  });

  describe("RF-30: fuera del horario", () => {
    it("muestra el aviso y la franja arriba del formulario, que sigue disponible", async () => {
      const login = vi.spyOn(auth, "login").mockRejectedValue(fueraDeHorario());
      const { persona } = await montar({ ahora: MARTES_1930, franja: { abierto: false } });
      expect(within(cabecera()).getByText("19:30")).toBeInTheDocument();
      const aviso = within(vidrio()).getByText(FUERA);
      const franja = within(vidrio()).getByText(FRANJA);
      expect(screen.getAllByText(FRANJA)).toHaveLength(1);
      expect(screen.queryByText(/^Próxima apertura/)).not.toBeInTheDocument();
      enOrden(aviso, franja, formulario());
      expect(campoUsuario()).toBeEnabled();
      expect(campoContrasena()).toBeEnabled();
      expect(botonIngresar()).toBeEnabled();
      await ingresar(persona);
      expect(login).toHaveBeenCalledTimes(1);
      await esperarAlerta("No se puede ingresar fuera del horario de atención.");
    });

    it("con la próxima apertura, la muestra debajo de la franja", async () => {
      await montar({ ahora: SABADO_1000, franja: { abierto: false, proxima_apertura: LUNES_0800 } });
      const franja = within(vidrio()).getByText(FRANJA);
      const proxima = within(vidrio()).getByText(PROXIMA);
      enOrden(within(vidrio()).getByText(FUERA), franja, proxima, formulario());
      expect(within(cabecera()).getByText("10:00")).toBeInTheDocument();
    });

    it("la próxima apertura aparece cuando llega, al reconsultar tras FUERA_DE_HORARIO", async () => {
      vi.spyOn(auth, "login").mockRejectedValue(fueraDeHorario());
      const reloj = relojFalso();
      const { persona } = await montar({ ahora: SABADO_1000, franja: { abierto: false }, reloj });
      expect(within(vidrio()).getByText(FUERA)).toBeInTheDocument();
      expect(screen.queryByText(PROXIMA)).not.toBeInTheDocument();
      vi.mocked(auth.horario).mockImplementation(
        horarioQueAvanza(horarioDe(SABADO_1000, { abierto: false, proxima_apertura: LUNES_0800 }), reloj),
      );
      await ingresar(persona);
      expect(await within(vidrio()).findByText(PROXIMA)).toBeInTheDocument();
      expect(alerta().textContent).toBe("No se puede ingresar fuera del horario de atención.");
    });
  });

  describe("RF-9 y RF-31: sin franja tras la falla", () => {
    it("cielo de las 13:00, sin reloj, 'No se pudo consultar el horario.' y el formulario habilitado", async () => {
      const login = vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      const { persona } = await montar({ franja: "falla" });
      expect(variable("--tq-cielo-arriba")).toBe("#4f98f0");
      expect(variable("--tq-cielo-abajo")).toBe("#e3f0ff");
      expect(variable("--tq-cielo-tinta")).toBe("#14233c");
      expect(pantalla()).toHaveAttribute("data-tinta", "#14233c");
      expect(screen.queryByText(HORA)).not.toBeInTheDocument();
      expect(screen.queryByText(FRANJA)).not.toBeInTheDocument();
      const aviso = within(vidrio()).getByText(SIN_FRANJA);
      enOrden(aviso, formulario());
      expect(campoUsuario()).toBeEnabled();
      expect(botonIngresar()).toBeEnabled();
      await ingresar(persona);
      expect(login).toHaveBeenCalledTimes(1);
      await esperarAlerta(INCORRECTOS);
    });
  });

  describe("RF-32: motivo de salida", () => {
    it("después de una caída, el motivo va arriba del formulario", async () => {
      await montar({ ruta: "/bandeja", me: meDe("operador") });
      expect(window.location.pathname).toBe("/bandeja");
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(EVENTO_SESION_CAIDA, { detail: { codigo: "SESION_INVALIDA", detalle: "La sesión no es válida o expiró." } }),
        );
      });
      expect(window.location.pathname).toBe("/ventanilla");
      const motivo = within(vidrio()).getByRole("status");
      expect(motivo.textContent).toBe("La sesión no es válida o expiró.");
      enOrden(motivo, screen.getByRole("heading", { level: 1, name: "Iniciar sesión" }), formulario());
      expect(campoUsuario()).toBeEnabled();
    });

    it("sin motivo ni comprobación pendiente, no hay línea de estado", async () => {
      await montar();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("RF-33: a dónde lleva el ingreso", () => {
    it("vuelve a la sección que se quería abrir", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar({ ruta: "/reportes" });
      expect(window.location.pathname).toBe("/ventanilla");
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/reportes"));
      expect(screen.queryByRole("form", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    });

    it("con un rol sin permiso para esa sección, aplica RF-24", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("usuario"));
      const { persona } = await montar({ ruta: "/reportes" });
      await ingresar(persona, "u.usuario");
      expect(await screen.findByRole("heading", { level: 1, name: "No tenés acceso a esta sección" })).toBeInTheDocument();
      expect(window.location.pathname).toBe("/reportes");
      expect(screen.getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("href", "/bandeja");
    });

    it("sin sección pedida, va a Tickets", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar();
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
    });

    it("D-16: con la sesión ya abierta, /ventanilla lleva a /bandeja", async () => {
      await montar({ me: meDe("operador") });
      expect(window.location.pathname).toBe("/bandeja");
      expect(screen.queryByRole("form", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    });
  });

  describe("RF-36: comprobación de la sesión", () => {
    it("'Verificando tu sesión…' arriba del formulario, que sigue visible y habilitado", async () => {
      await montar({ me: "pendiente" });
      const estado = within(vidrio()).getByRole("status");
      expect(estado.textContent).toBe(VERIFICANDO);
      enOrden(estado, screen.getByRole("heading", { level: 1, name: "Iniciar sesión" }), formulario());
      expect(campoUsuario()).toBeEnabled();
      expect(campoContrasena()).toBeEnabled();
      expect(botonIngresar()).toBeEnabled();
      expect(campoUsuario()).toHaveFocus();
    });
  });

  describe("orden dentro del vidrio", () => {
    it("estado, aviso, título, campos, error y botón", async () => {
      vi.spyOn(auth, "login").mockRejectedValue(credencialesInvalidas());
      const { persona } = await montar({ me: "pendiente", ahora: MARTES_1930, franja: { abierto: false } });
      await ingresar(persona, "u.operador", "mala");
      await esperarAlerta(INCORRECTOS);
      enOrden(
        within(vidrio()).getByRole("status"),
        within(vidrio()).getByText(FUERA),
        screen.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
        screen.getByText("Usá tu cuenta de dominio"),
        grupo(),
        alerta(),
        botonIngresar(),
      );
      expect(formulario()).toContainElement(alerta());
    });
  });

  describe("D-26: la franja después de ingresar", () => {
    it("vuelve a pedir la franja sin esperarla para entrar", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar();
      const horario = vi.mocked(auth.horario);
      expect(horario).toHaveBeenCalledTimes(1);
      horario.mockReturnValue(new Promise<Horario>(() => undefined));
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
      expect(horario).toHaveBeenCalledTimes(2);
    });

    it("con la franja caída en el inicio de sesión, también la vuelve a pedir", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar({ franja: "falla" });
      const horario = vi.mocked(auth.horario);
      expect(horario).toHaveBeenCalledTimes(1);
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
      expect(horario).toHaveBeenCalledTimes(2);
    });
  });
});
