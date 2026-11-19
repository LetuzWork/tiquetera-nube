import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, EVENTO_SESION_CAIDA } from "../api/client";
import { auth, tickets } from "../api/endpoints";
import type { Horario, Me, Rol } from "../api/types";
import { horarioDe, meDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";
import { avanzar, cambiarVisibilidad, relojFalso, type RelojFalso } from "../test/tiempo";

const MARTES_1420 = "2026-11-17T17:20:00Z";
const MARTES_1759 = "2026-11-17T20:59:00Z";
const MARTES_1801 = "2026-11-17T21:01:00Z";
const MINUTO = 60_000;

const FUERA_DE_HORARIO = { codigo: "SESION_FUERA_DE_HORARIO", detalle: "La franja horaria cerró y la sesión caducó." };
const SESION_INVALIDA = { codigo: "SESION_INVALIDA", detalle: "La sesión no es válida o expiró." };

const JORNADA_TERMINO = "La jornada terminó";
const TEXTO_JORNADA = "El acceso está disponible de lunes a viernes, de 08:00 a 18:00. Tu sesión se cerró.";
const SESION_VENCIO = "Tu sesión venció";
const TEXTO_SESION = "Iniciá sesión de nuevo para seguir.";

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

interface Opciones {
  ruta?: string;
  me?: Me | null | "pendiente";
  ahora?: string;
  reloj?: RelojFalso;
}

async function montar({ ruta = "/bandeja", me = meDe("operador"), ahora = MARTES_1420, reloj = relojFalso() }: Opciones = {}) {
  vi.spyOn(auth, "logout").mockResolvedValue(undefined);
  if (me === "pendiente") vi.spyOn(auth, "me").mockReturnValue(new Promise<Me>(() => undefined));
  const app = await renderizarApp({ ruta, me: me === "pendiente" ? null : me, horario: horarioDe(ahora), reloj });
  return { ...app, persona: userEvent.setup() };
}

function sesionQueVence(sesionExpira: string, segundosRestantes: number): Me {
  return meDe("operador", { sesion_expira: sesionExpira, segundos_restantes: segundosRestantes });
}

function servidorQueResponde(cuerpo: { codigo: string; detalle: string }, estado: number) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(cuerpo), { status: estado }));
}

async function caer(caida: { codigo: string; detalle: string }) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA, { detail: caida }));
  });
}

const cielo = () => screen.getByRole("banner");
const vidrio = () => screen.getByRole("main");
const secciones = () => screen.getByRole("navigation", { name: "Secciones" });
const aceptar = () => screen.getByRole("button", { name: "Aceptar" });
const regionAviso = () => screen.getByRole("status");
const pedidosDelHorizonte = () =>
  vi.mocked(tickets.listar).mock.calls.filter(([, , porPagina]) => porPagina === 100).length;

function contenidoDelVidrio(): HTMLElement {
  const contenido = screen.getByRole("main", { hidden: true }).querySelector<HTMLElement>("[data-desenfocado]");
  if (!contenido) throw new Error("El vidrio no tiene su contenido");
  return contenido;
}

function pildoraDe(region: HTMLElement): Element {
  const pildora = region.closest("[data-abierto]");
  if (!pildora) throw new Error("El aviso no tiene data-abierto");
  return pildora;
}

async function aceptarYSalir(persona: UserEvent) {
  await persona.click(aceptar());
  await waitFor(() => expect(window.location.pathname).toBe("/ventanilla"));
}

async function ingresar(persona: UserEvent) {
  await persona.type(screen.getByRole("textbox", { name: "Usuario" }), "u.operador");
  await persona.type(screen.getByLabelText("Contraseña"), "secreta");
  await persona.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("Marco", () => {
  describe("RF-16 y RF-17: el cielo arriba de cada sección", () => {
    it("muestra el logo, la navegación, la cuenta, el reloj, el estado y el horizonte, con la sección en el vidrio", async () => {
      await montar();
      const arriba = within(cielo());
      expect(arriba.getByText("Tiquetera Nube")).toBeInTheDocument();
      expect(arriba.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
      expect(arriba.getByRole("button", { name: "Cuenta de Omar Operador" })).toBeInTheDocument();
      expect(arriba.getByText("14:20")).toBeInTheDocument();
      expect(arriba.getByText("Quedan 3 h 40 min de jornada")).toBeInTheDocument();
      expect(arriba.getByText("Lunes a viernes, de 08:00 a 18:00")).toBeInTheDocument();
      expect(
        await arriba.findByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 14:20. Hoy no entró ningún ticket." }),
      ).toBeInTheDocument();
      expect(vidrio()).toHaveAttribute("data-variante", "marco");
      expect(within(vidrio()).getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
      expect(contenidoDelVidrio()).toHaveAttribute("data-desenfocado", "false");
    });

    it("ya no está el encabezado viejo", async () => {
      await montar();
      expect(screen.queryByRole("navigation", { name: "Principal" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Salir" })).not.toBeInTheDocument();
    });

    it.each<[Rol, string[]]>([
      ["admin", ["Tickets", "Nuevo ticket", "Reportes"]],
      ["operador", ["Tickets", "Nuevo ticket", "Reportes"]],
      ["usuario", ["Tickets", "Nuevo ticket"]],
      ["consulta", ["Tickets", "Reportes"]],
    ])("con el rol %s, la navegación muestra %j con Tickets marcada", async (rol, esperadas) => {
      await montar({ me: meDe(rol) });
      const enlaces = within(secciones()).getAllByRole("link");
      expect(enlaces.map((enlace) => enlace.textContent)).toEqual(esperadas);
      expect(within(secciones()).getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
    });

    it("en el detalle de un ticket, la sección marcada es Tickets", async () => {
      await montar({ ruta: "/tickets/45" });
      expect(within(secciones()).getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
      expect(within(secciones()).getByRole("link", { name: "Reportes" })).not.toHaveAttribute("aria-current");
      expect(within(secciones()).getByRole("link", { name: "Nuevo ticket" })).not.toHaveAttribute("aria-current");
    });
  });

  describe("RF-19: la cuenta", () => {
    it("'Cerrar sesión' sale sin motivo y lleva al inicio de sesión", async () => {
      const { persona } = await montar();
      await persona.click(screen.getByRole("button", { name: "Cuenta de Omar Operador" }));
      expect(screen.getByRole("menu")).toHaveAccessibleDescription("Sesión hasta las 18:00");
      await persona.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
      await waitFor(() => expect(window.location.pathname).toBe("/ventanilla"));
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(within(vidrio()).queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("RF-21: aviso de sesión", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("la región del aviso ya está en la página, vacía y sin píldora, antes de que llegue el texto", async () => {
      const reloj = relojFalso();
      await montar({ me: sesionQueVence("2026-11-17T14:30:00-03:00", 600), reloj });
      const region = regionAviso();
      expect(region).toBeEmptyDOMElement();
      expect(pildoraDe(region)).toHaveAttribute("data-abierto", "false");
      expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
      await avanzar(5 * MINUTO, reloj);
      expect(regionAviso()).toBe(region);
      expect(region.textContent).toBe("Tu sesión vence a las 14:30.");
      expect(pildoraDe(region)).toHaveAttribute("data-abierto", "true");
    });

    it("sale una vez a los 5 minutos del vencimiento y no vuelve después de cerrarlo", async () => {
      const reloj = relojFalso();
      const { persona } = await montar({ me: sesionQueVence("2026-11-17T14:30:00-03:00", 600), reloj });
      await avanzar(4 * MINUTO + 59_000, reloj);
      expect(regionAviso()).toBeEmptyDOMElement();
      await avanzar(1_000, reloj);
      expect(regionAviso().textContent).toBe("Tu sesión vence a las 14:30.");
      await persona.click(screen.getByRole("button", { name: "Cerrar aviso" }));
      expect(regionAviso()).toBeEmptyDOMElement();
      expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
      await avanzar(2 * MINUTO, reloj);
      expect(regionAviso()).toBeEmptyDOMElement();
      expect(screen.queryByText("Tu sesión vence a las 14:30.")).not.toBeInTheDocument();
    });

    it("al abrir con 5 minutos o menos, sale enseguida", async () => {
      await montar({ me: sesionQueVence("2026-11-17T14:23:00-03:00", 180) });
      await waitFor(() => expect(regionAviso().textContent).toBe("Tu sesión vence a las 14:23."));
      expect(screen.getByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
    });
  });

  describe("RF-22: diálogo de fin", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("al vencer por la duración, 'Tu sesión venció' sobre el contenido desenfocado, y 'Aceptar' deja su motivo", async () => {
      const reloj = relojFalso();
      const { persona } = await montar({ ruta: "/reportes", me: sesionQueVence("2026-11-17T14:30:00-03:00", 600), reloj });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      await avanzar(10 * MINUTO, reloj);
      const dialogo = screen.getByRole("alertdialog", { name: SESION_VENCIO });
      expect(dialogo).toHaveAccessibleDescription(TEXTO_SESION);
      expect(aceptar()).toHaveFocus();
      expect(contenidoDelVidrio()).toHaveAttribute("data-desenfocado", "true");
      await aceptarYSalir(persona);
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(within(vidrio()).getByRole("status").textContent).toBe("Tu sesión venció.");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("al vencer a las 18:00, 'La jornada terminó' con la franja", async () => {
      const reloj = relojFalso();
      await montar({ ahora: MARTES_1759, me: sesionQueVence("2026-11-17T18:00:00-03:00", 60), reloj });
      await avanzar(59_000, reloj);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      await avanzar(1_000, reloj);
      expect(screen.getByRole("alertdialog", { name: JORNADA_TERMINO })).toHaveAccessibleDescription(TEXTO_JORNADA);
      expect(aceptar()).toHaveFocus();
    });

    it("un 401 por horario real, vía fetch, abre el diálogo de la jornada", async () => {
      servidorQueResponde(FUERA_DE_HORARIO, 401);
      await montar({ ruta: "/reportes" });
      const dialogo = await screen.findByRole("alertdialog", { name: JORNADA_TERMINO });
      expect(dialogo).toHaveAccessibleDescription(TEXTO_JORNADA);
      expect(window.location.pathname).toBe("/reportes");
      expect(screen.getByRole("button", { name: "Cuenta de Omar Operador", hidden: true })).toBeInTheDocument();
      expect(contenidoDelVidrio()).toHaveAttribute("data-desenfocado", "true");
    });

    it("mientras está abierto, el resto del marco queda inert y aria-hidden, y el diálogo no", async () => {
      await montar();
      expect(cielo().closest("[inert]")).toBeNull();
      expect(cielo().closest('[aria-hidden="true"]')).toBeNull();
      await caer(FUERA_DE_HORARIO);
      const dialogo = screen.getByRole("alertdialog", { name: JORNADA_TERMINO });
      const resto = screen.getByRole("banner", { hidden: true }).closest("[inert]");
      expect(resto).not.toBeNull();
      expect(resto).toHaveAttribute("aria-hidden", "true");
      expect(resto).toContainElement(screen.getByRole("main", { hidden: true }));
      expect(resto).toContainElement(screen.getByRole("status", { hidden: true }));
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(dialogo.closest("[inert]")).toBeNull();
      expect(dialogo.closest('[aria-hidden="true"]')).toBeNull();
    });

    it("Esc no lo cierra y el foco no sale de 'Aceptar'", async () => {
      const { persona } = await montar();
      await caer(FUERA_DE_HORARIO);
      expect(aceptar()).toHaveFocus();
      await persona.keyboard("{Escape}");
      expect(screen.getByRole("alertdialog", { name: JORNADA_TERMINO })).toBeInTheDocument();
      await persona.tab();
      expect(aceptar()).toHaveFocus();
      expect(window.location.pathname).toBe("/bandeja");
    });

    it("'Aceptar' cierra la sesión y lleva al inicio de sesión con el motivo", async () => {
      const { persona } = await montar({ ruta: "/reportes" });
      await caer(FUERA_DE_HORARIO);
      await aceptarYSalir(persona);
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(within(vidrio()).getByRole("status").textContent).toBe("La jornada terminó.");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByRole("form", { name: "Iniciar sesión" })).toBeInTheDocument();
    });

    describe("D-07: rechazo por horario sin franja", () => {
      it("consulta la franja una vez y abre el diálogo de la jornada cuando responde", async () => {
        const pendiente: { responder?: (horario: Horario) => void } = {};
        const horario = vi
          .spyOn(auth, "horario")
          .mockRejectedValueOnce(sinConexion())
          .mockReturnValueOnce(
            new Promise<Horario>((responder) => {
              pendiente.responder = responder;
            }),
          );
        await montar();
        expect(within(cielo()).getByText("No se pudo consultar el horario.")).toBeInTheDocument();
        expect(horario).toHaveBeenCalledTimes(1);
        await caer(FUERA_DE_HORARIO);
        expect(horario).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(contenidoDelVidrio()).toHaveAttribute("data-desenfocado", "true");
        await act(async () => {
          pendiente.responder?.(horarioDe(MARTES_1801));
        });
        expect(screen.getByRole("alertdialog", { name: JORNADA_TERMINO })).toHaveAccessibleDescription(TEXTO_JORNADA);
        expect(aceptar()).toHaveFocus();
        expect(horario).toHaveBeenCalledTimes(2);
      });

      it("si la franja tampoco llega, abre el de la duración", async () => {
        const horario = vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
        const { persona } = await montar();
        await caer(FUERA_DE_HORARIO);
        const dialogo = await screen.findByRole("alertdialog", { name: SESION_VENCIO });
        expect(dialogo).toHaveAccessibleDescription(TEXTO_SESION);
        expect(horario).toHaveBeenCalledTimes(2);
        await aceptarYSalir(persona);
        expect(within(vidrio()).getByRole("status").textContent).toBe("Tu sesión venció.");
      });
    });
  });

  describe("RF-15, RF-22 y RF-33: un nuevo ingreso después del diálogo", () => {
    it("RF-33: volver a ingresar lleva a la sección en la que estaba", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar({ ruta: "/reportes" });
      await caer(FUERA_DE_HORARIO);
      await aceptarYSalir(persona);
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/reportes"));
      expect(within(vidrio()).getByRole("heading", { level: 1, name: "Reportes" })).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("sin pausa ni caídas ignoradas: el horizonte vuelve a pedir tickets y un nuevo 401 por horario abre otra vez el diálogo", async () => {
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const { persona } = await montar({ ruta: "/reportes" });
      await caer(FUERA_DE_HORARIO);
      await aceptarYSalir(persona);
      const antes = pedidosDelHorizonte();
      await ingresar(persona);
      await waitFor(() => expect(window.location.pathname).toBe("/reportes"));
      await waitFor(() => expect(pedidosDelHorizonte()).toBeGreaterThan(antes));
      const trasIngresar = pedidosDelHorizonte();
      await cambiarVisibilidad("visible");
      expect(pedidosDelHorizonte()).toBe(trasIngresar + 1);
      await caer(FUERA_DE_HORARIO);
      expect(screen.getByRole("alertdialog", { name: JORNADA_TERMINO })).toHaveAccessibleDescription(TEXTO_JORNADA);
    });
  });

  describe("RF-23: sesión no válida", () => {
    it("un 401 SESION_INVALIDA real, vía fetch, lleva al inicio de sesión con el motivo del servidor", async () => {
      servidorQueResponde(SESION_INVALIDA, 401);
      await montar({ ruta: "/tickets/45" });
      await waitFor(() => expect(window.location.pathname).toBe("/ventanilla"));
      expect(within(vidrio()).getByRole("status").textContent).toBe("La sesión no es válida o expiró.");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("RF-36: comprobación de la sesión", () => {
    it("'Verificando tu sesión…' mientras se comprueba, sin el marco", async () => {
      await montar({ me: "pendiente" });
      expect(screen.getByRole("status").textContent).toBe("Verificando tu sesión…");
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
    });
  });

  describe("RF-24: sin permiso", () => {
    it("'No tenés acceso a esta sección' va dentro del marco", async () => {
      await montar({ ruta: "/reportes", me: meDe("usuario") });
      expect(within(cielo()).getByRole("button", { name: "Cuenta de Ursula Usuaria" })).toBeInTheDocument();
      expect(within(vidrio()).getByRole("heading", { level: 1, name: "No tenés acceso a esta sección" })).toBeInTheDocument();
      expect(within(vidrio()).getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("href", "/bandeja");
      expect(within(secciones()).queryByRole("link", { name: "Reportes" })).not.toBeInTheDocument();
    });
  });

  describe("RF-35: página inexistente", () => {
    it.each(["/no-existe", "/tickets/45/historial"])(
      "en %s, 'Esta página no existe.' con 'Volver a Tickets', dentro del marco",
      async (ruta) => {
        const { persona } = await montar({ ruta });
        expect(cielo()).toBeInTheDocument();
        expect(within(vidrio()).getByRole("heading", { level: 1, name: "Esta página no existe." })).toBeInTheDocument();
        const icono = vidrio().querySelector('svg[aria-hidden="true"]');
        expect(icono).toHaveAttribute("stroke-width", "1.75");
        expect(screen.queryByText("Esta ventanilla no existe.")).not.toBeInTheDocument();
        const volver = within(vidrio()).getByRole("link", { name: "Volver a Tickets" });
        expect(volver).toHaveAttribute("href", "/bandeja");
        await persona.click(volver);
        expect(window.location.pathname).toBe("/bandeja");
        expect(within(vidrio()).getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
      },
    );

    it("sin sesión, una dirección desconocida lleva al inicio de sesión", async () => {
      await montar({ ruta: "/no-existe", me: null });
      expect(window.location.pathname).toBe("/ventanilla");
      expect(screen.queryByText("Esta página no existe.")).not.toBeInTheDocument();
    });
  });

  describe("RNF-1: un solo tema", () => {
    it("no hay 'Turno noche' ni 'Turno día', y nadie marca data-turno", async () => {
      await montar();
      expect(screen.queryByRole("button", { name: /^Turno (noche|día)$/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Turno (noche|día)/)).not.toBeInTheDocument();
      expect(document.documentElement).not.toHaveAttribute("data-turno");
    });
  });
});
