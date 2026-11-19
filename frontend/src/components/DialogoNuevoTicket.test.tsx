import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { tickets, usuarios } from "../api/endpoints";
import type { Me, Pagina, Rol, Ticket, TicketResumen } from "../api/types";
import { horarioDe, meDe, paginaDe, ticketResumenDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";
import { avanzar, relojFalso, type RelojFalso } from "../test/tiempo";

// Miércoles 18 de noviembre, 17:00 en Buenos Aires.
const AHORA = "2026-11-18T20:00:00Z";
const AYER = "2026-11-17T23:30:00Z";
const A_LAS_1700 = "2026-11-18T20:00:00Z";
const POR_PAGINA = 25;

const TITULO = "Sin internet en el piso 3";
const DESCRIPCION = "Desde las 15 no carga ninguna página.";

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

const cuenta = (rol: Rol): Me => meDe(rol, { sesion_expira: "2026-11-18T18:00:00-03:00", segundos_restantes: 3600 });

const ticket = (numero: number, cambios: Partial<TicketResumen> = {}) =>
  ticketResumenDe({ numero, creado_en: AYER, ...cambios });

function ticketCreado(numero: number): Ticket {
  const resumen = ticket(numero, { titulo: TITULO, categoria: "Red", creado_en: A_LAS_1700 });
  return { ...resumen, descripcion: DESCRIPCION, comentarios: [], historial: [], acciones: [] };
}

interface Opciones {
  ruta?: string;
  me?: Me;
  lista?: () => TicketResumen[];
  reloj?: RelojFalso;
}

async function montar({ ruta = "/bandeja", me = cuenta("usuario"), lista = () => [ticket(45)], reloj = relojFalso() }: Opciones = {}) {
  vi.spyOn(usuarios, "responsables").mockResolvedValue([]);
  vi.spyOn(tickets, "listar").mockImplementation(async (_filtros, numeroPagina = 1, porPagina = 20): Promise<Pagina> => {
    if (porPagina !== POR_PAGINA) return paginaDe([], { por_pagina: porPagina });
    const items = lista();
    return paginaDe(items, { pagina: numeroPagina, por_pagina: POR_PAGINA });
  });
  const app = await renderizarApp({ ruta, me, horario: horarioDe(AHORA), reloj });
  return { ...app, persona: userEvent.setup() };
}

const vidrio = () => within(screen.getByRole("main", { hidden: true }));
const dialogo = () => screen.getByRole("dialog", { name: "Nuevo ticket" });
const enDialogo = () => within(dialogo());
const campoTitulo = () => enDialogo().getByRole("textbox", { name: "Título" });
const campoDescripcion = () => enDialogo().getByRole("textbox", { name: "Descripción" });
const campoCategoria = () => enDialogo().getByRole("combobox", { name: "Categoría" });
const prioridad = () => enDialogo().getByRole("radiogroup", { name: "Prioridad" });
const opcionPrioridad = (nombre: string) => within(prioridad()).getByRole("radio", { name: nombre });
const botonCrear = () => enDialogo().getByRole("button", { name: "Crear" });
const botonNuevo = () => within(screen.getByRole("main")).getByRole("link", { name: "Nuevo ticket" });
const enlaceNavegacion = () => within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("link", { name: "Nuevo ticket" });

const pedidosBandeja = () => vi.mocked(tickets.listar).mock.calls.filter(([, , porPagina]) => porPagina === POR_PAGINA);
const parametros = () => Object.fromEntries(new URLSearchParams(window.location.search));

function filas(): HTMLElement[] {
  return vidrio()
    .queryAllByRole("link", { hidden: true })
    .filter((enlace) => /^\/tickets\/\d+$/.test(enlace.getAttribute("href") ?? ""));
}

function fila(numero: number): HTMLElement {
  const encontrada = filas().find((enlace) => enlace.getAttribute("href") === `/tickets/${numero}`);
  if (!encontrada) throw new Error(`No está la fila de TQ-${numero}`);
  return encontrada;
}

async function abrirDesdeLaBandeja(persona: UserEvent) {
  await waitFor(() => expect(filas().length).toBeGreaterThan(0));
  await persona.click(botonNuevo());
  return screen.findByRole("dialog", { name: "Nuevo ticket" });
}

async function completar(persona: UserEvent, titulo = TITULO, descripcion = DESCRIPCION) {
  if (titulo) await persona.type(campoTitulo(), titulo);
  if (descripcion) await persona.type(campoDescripcion(), descripcion);
}

function enOrden(previo: HTMLElement, siguiente: HTMLElement) {
  expect(previo.compareDocumentPosition(siguiente) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("DialogoNuevoTicket", () => {
  describe("RF-14: se abre sobre la bandeja", () => {
    it("desde 'Nuevo ticket' de la bandeja: diálogo modal con el foco en 'Título' y la vista en la dirección", async () => {
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn" });
      await waitFor(() => expect(filas()).toHaveLength(1));
      expect(botonNuevo()).toHaveAttribute("href", "/tickets/nuevo?estado=ABIERTO&q=vpn");
      const abierto = await abrirDesdeLaBandeja(persona);
      expect(abierto).toHaveAttribute("aria-modal", "true");
      expect(campoTitulo()).toHaveFocus();
      expect(window.location.pathname).toBe("/tickets/nuevo");
      expect(parametros()).toEqual({ estado: "ABIERTO", q: "vpn" });
      expect(vidrio().getByRole("heading", { level: 1, name: "Tickets", hidden: true })).toBeInTheDocument();
      expect(fila(45)).toBeInTheDocument();
    });

    it("mientras está abierto, el resto queda inert y aria-hidden, y el diálogo no", async () => {
      const { persona } = await montar();
      const abierto = await abrirDesdeLaBandeja(persona);
      const resto = screen.getByRole("main", { hidden: true }).closest("[inert]");
      expect(resto).not.toBeNull();
      expect(resto).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(abierto.closest("[inert]")).toBeNull();
      expect(abierto.closest('[aria-hidden="true"]')).toBeNull();
    });

    it("desde el enlace de la navegación", async () => {
      const { persona } = await montar();
      await waitFor(() => expect(filas()).toHaveLength(1));
      await persona.click(enlaceNavegacion());
      expect(await screen.findByRole("dialog", { name: "Nuevo ticket" })).toHaveAttribute("aria-modal", "true");
      expect(campoTitulo()).toHaveFocus();
      expect(window.location.pathname).toBe("/tickets/nuevo");
    });

    it("entrando directo a /tickets/nuevo, con la bandeja detrás", async () => {
      await montar({ ruta: "/tickets/nuevo" });
      expect(await screen.findByRole("dialog", { name: "Nuevo ticket" })).toHaveAttribute("aria-modal", "true");
      expect(campoTitulo()).toHaveFocus();
      await waitFor(() => expect(filas()).toHaveLength(1));
    });

    it("trae 'Detalle' con Título, Categoría 'Hardware' y Prioridad 'Media', y 'Descripción' con su contador", async () => {
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      const detalle = enDialogo().getByRole("group", { name: "Detalle" });
      expect(detalle).toContainElement(campoTitulo());
      expect(detalle).toContainElement(campoCategoria());
      expect(detalle).toContainElement(prioridad());
      expect(enDialogo().getByRole("group", { name: "Descripción" })).toContainElement(campoDescripcion());

      expect(campoTitulo()).toHaveAccessibleDescription("0/120");
      await persona.type(campoTitulo(), "Sin internet");
      expect(enDialogo().getByText("12/120")).toBeInTheDocument();
      expect(campoTitulo()).toHaveAccessibleDescription("12/120");

      expect(campoCategoria()).toHaveDisplayValue("Hardware");
      expect(within(campoCategoria()).getAllByRole("option").map((opcion) => opcion.textContent)).toEqual([
        "Hardware",
        "Software",
        "Red",
        "Accesos",
        "Otro",
      ]);
      expect(within(prioridad()).getAllByRole("radio").map((opcion) => opcion.textContent)).toEqual(["Baja", "Media", "Alta", "Crítica"]);
      expect(opcionPrioridad("Media")).toBeChecked();
      expect(enDialogo().getByText("0/5000")).toBeInTheDocument();
      expect(campoDescripcion()).toHaveAccessibleDescription("0/5000");
      expect(enDialogo().getByRole("button", { name: "Cancelar" })).toBeEnabled();
      expect(botonCrear()).toHaveAttribute("type", "submit");
      expect(enDialogo().getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    });

    it("Tab y Shift+Tab no salen del diálogo", async () => {
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      const cerrar = enDialogo().getByRole("button", { name: "Cerrar" });
      const recorrido = [
        campoCategoria(),
        opcionPrioridad("Media"),
        campoDescripcion(),
        enDialogo().getByRole("button", { name: "Cancelar" }),
        botonCrear(),
        cerrar,
        campoTitulo(),
      ];
      for (const esperado of recorrido) {
        await persona.tab();
        expect(esperado).toHaveFocus();
      }
      await persona.tab({ shift: true });
      expect(cerrar).toHaveFocus();
      await persona.tab({ shift: true });
      expect(botonCrear()).toHaveFocus();
    });

    it.each<[string, (persona: UserEvent) => Promise<void>]>([
      ["Esc", (persona) => persona.keyboard("{Escape}")],
      ["'Cancelar'", (persona) => persona.click(enDialogo().getByRole("button", { name: "Cancelar" }))],
      ["'Cerrar'", (persona) => persona.click(enDialogo().getByRole("button", { name: "Cerrar" }))],
    ])("%s cierra sin preguntar, vuelve a la bandeja con su vista y devuelve el foco a 'Nuevo ticket'", async (_forma, cerrar) => {
      const crear = vi.spyOn(tickets, "crear");
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn" });
      await abrirDesdeLaBandeja(persona);
      await persona.type(campoTitulo(), "A medio escribir");
      await cerrar(persona);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO", q: "vpn" });
      expect(botonNuevo()).toHaveFocus();
      expect(screen.getByRole("main").closest("[inert]")).toBeNull();
      expect(crear).not.toHaveBeenCalled();
    });

    it("abierto desde la navegación, cerrar devuelve el foco a ese enlace", async () => {
      const { persona } = await montar();
      await waitFor(() => expect(filas()).toHaveLength(1));
      await persona.click(enlaceNavegacion());
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await persona.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(window.location.pathname).toBe("/bandeja");
      expect(enlaceNavegacion()).toHaveFocus();
    });

    it("RF-14 y RF-8: desde la bandeja con filtros, el enlace de la navegación conserva la vista detrás y al cerrar", async () => {
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn" });
      await waitFor(() => expect(filas()).toHaveLength(1));
      expect(enlaceNavegacion()).toHaveAttribute("href", "/tickets/nuevo?estado=ABIERTO&q=vpn");
      const retroceder = vi.spyOn(window.history, "go");
      await persona.click(enlaceNavegacion());
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      expect(window.location.pathname).toBe("/tickets/nuevo");
      expect(parametros()).toEqual({ estado: "ABIERTO", q: "vpn" });
      expect(pedidosBandeja().at(-1)?.[0]).toEqual({ estado: "ABIERTO", q: "vpn" });
      await persona.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(retroceder).toHaveBeenCalledWith(-1);
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO", q: "vpn" });
      expect(enlaceNavegacion()).toHaveFocus();
    });

    it("dos Esc seguidos, antes de que la dirección cambie, piden retroceder una sola vez", async () => {
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO" });
      await abrirDesdeLaBandeja(persona);
      // jsdom junta dos retrocesos seguidos en uno; un navegador no siempre, así que se cuentan los pedidos.
      const retroceder = vi.spyOn(window.history, "go");
      fireEvent.keyDown(dialogo(), { key: "Escape" });
      fireEvent.keyDown(dialogo(), { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(retroceder).toHaveBeenCalledTimes(1);
      expect(retroceder).toHaveBeenCalledWith(-1);
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO" });
    });

    it("entrando directo, cerrar reemplaza la dirección por la de la bandeja con su vista", async () => {
      const { persona } = await montar({ ruta: "/tickets/nuevo?estado=ABIERTO" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      const largo = window.history.length;
      await persona.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO" });
      expect(window.history.length).toBe(largo);
    });
  });

  describe("RF-15: errores sin consultar al servidor", () => {
    it("vacío: los errores de título y descripción, con el foco en 'Título' y 'Crear' habilitado", async () => {
      const crear = vi.spyOn(tickets, "crear");
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await persona.click(botonCrear());
      expect(enDialogo().getByText("El título necesita al menos 5 caracteres.")).toBeInTheDocument();
      expect(campoTitulo()).toHaveAccessibleDescription(expect.stringContaining("El título necesita al menos 5 caracteres."));
      expect(campoTitulo()).toHaveAttribute("aria-invalid", "true");
      expect(campoDescripcion()).toHaveAccessibleDescription(expect.stringContaining("Contá el problema en al menos 10 caracteres."));
      expect(campoDescripcion()).toHaveAttribute("aria-invalid", "true");
      expect(campoTitulo()).toHaveFocus();
      expect(botonCrear()).toBeEnabled();
      expect(crear).not.toHaveBeenCalled();
    });

    it("con el título bien y la descripción corta, el foco va a 'Descripción'", async () => {
      const crear = vi.spyOn(tickets, "crear");
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await completar(persona, TITULO, "  corta   ");
      await persona.click(botonCrear());
      expect(campoTitulo()).not.toHaveAttribute("aria-invalid");
      expect(campoDescripcion()).toHaveAccessibleDescription(expect.stringContaining("Contá el problema en al menos 10 caracteres."));
      expect(campoDescripcion()).toHaveFocus();
      expect(crear).not.toHaveBeenCalled();
    });

    it("de más: 'El título admite hasta 120 caracteres.' y 'La descripción admite hasta 5000 caracteres.'", async () => {
      const crear = vi.spyOn(tickets, "crear");
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      // El maxlength frena el teclado; un valor puesto por programa (autocompletar, pegado de una extensión) no.
      fireEvent.change(campoTitulo(), { target: { value: "a".repeat(121) } });
      fireEvent.change(campoDescripcion(), { target: { value: "b".repeat(5001) } });
      await persona.click(botonCrear());
      expect(campoTitulo()).toHaveAccessibleDescription(expect.stringContaining("El título admite hasta 120 caracteres."));
      expect(campoDescripcion()).toHaveAccessibleDescription(expect.stringContaining("La descripción admite hasta 5000 caracteres."));
      expect(campoTitulo()).toHaveFocus();
      expect(crear).not.toHaveBeenCalled();
    });

    it("al corregir un campo, se va su error y queda el otro", async () => {
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await persona.click(botonCrear());
      await persona.type(campoTitulo(), "Sin");
      expect(campoTitulo()).not.toHaveAttribute("aria-invalid");
      expect(enDialogo().queryByText("El título necesita al menos 5 caracteres.")).not.toBeInTheDocument();
      expect(campoDescripcion()).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("RF-16 y RF-17: el envío", () => {
    it("manda lo escrito recortado con la categoría y la prioridad elegidas, y muestra 'Creando…' deshabilitado", async () => {
      const crear = vi.spyOn(tickets, "crear").mockReturnValue(new Promise<Ticket>(() => undefined));
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await completar(persona, `  ${TITULO}  `, ` ${DESCRIPCION} `);
      await persona.selectOptions(campoCategoria(), "Red");
      await persona.click(opcionPrioridad("Alta"));
      await persona.click(botonCrear());
      expect(crear).toHaveBeenCalledTimes(1);
      expect(crear).toHaveBeenCalledWith({ titulo: TITULO, descripcion: DESCRIPCION, categoria: "Red", prioridad: "ALTA" });
      const creando = enDialogo().getByRole("button", { name: "Creando…" });
      expect(creando).toBeDisabled();
      expect(enDialogo().queryByRole("button", { name: "Crear" })).not.toBeInTheDocument();
      await persona.click(creando);
      await persona.type(campoTitulo(), "{Enter}");
      expect(crear).toHaveBeenCalledTimes(1);
    });

    it("los errores de campo del servidor van a su campo, con el foco en el primero", async () => {
      vi.spyOn(tickets, "crear").mockRejectedValue(
        new ApiError(422, "ENTRADA_INVALIDA", "Revisá los datos enviados.", {
          errores: [
            { campo: "categoria", mensaje: "La categoría no es válida." },
            { campo: "titulo", mensaje: "El título no puede tener solo símbolos." },
          ],
        }),
      );
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await completar(persona);
      await persona.click(botonCrear());
      await waitFor(() =>
        expect(campoTitulo()).toHaveAccessibleDescription(expect.stringContaining("El título no puede tener solo símbolos.")),
      );
      expect(campoCategoria()).toHaveAccessibleDescription("La categoría no es válida.");
      expect(campoCategoria()).toHaveAttribute("aria-invalid", "true");
      expect(campoTitulo()).toHaveFocus();
      expect(enDialogo().queryByRole("alert")).not.toBeInTheDocument();
      expect(botonCrear()).toBeEnabled();
    });

    it("ante otro error: 'No se pudo crear el ticket.' arriba del botón, sin perder lo escrito", async () => {
      vi.spyOn(tickets, "crear").mockRejectedValue(sinConexion());
      const { persona } = await montar({ ruta: "/tickets/nuevo" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await completar(persona);
      await persona.selectOptions(campoCategoria(), "Red");
      await persona.click(opcionPrioridad("Alta"));
      await persona.click(botonCrear());
      const alerta = await enDialogo().findByRole("alert");
      expect(alerta.textContent).toBe("No se pudo crear el ticket.");
      enOrden(alerta, botonCrear());
      expect(campoTitulo()).toHaveValue(TITULO);
      expect(campoDescripcion()).toHaveValue(DESCRIPCION);
      expect(campoCategoria()).toHaveDisplayValue("Red");
      expect(opcionPrioridad("Alta")).toBeChecked();
      expect(botonCrear()).toBeEnabled();
    });
  });

  describe("RF-18 y RF-27: al crearse", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    async function crearDesdeLaBandeja(reloj: RelojFalso) {
      let lista = [ticket(45)];
      vi.spyOn(tickets, "crear").mockImplementation(async () => {
        lista = [ticket(54, { titulo: TITULO, categoria: "Red", creado_en: A_LAS_1700 }), ...lista];
        return ticketCreado(54);
      });
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO", lista: () => lista, reloj });
      await abrirDesdeLaBandeja(persona);
      const antes = pedidosBandeja().length;
      await completar(persona);
      await persona.click(botonCrear());
      return { persona, antes };
    }

    it("cierra el diálogo, recarga la bandeja, avisa 'Ticket TQ-000054 creado' y resalta su fila", async () => {
      const { antes } = await crearDesdeLaBandeja(relojFalso());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO" });
      const aviso = await screen.findByText("Ticket TQ-000054 creado");
      expect(aviso.closest('[role="status"]')).not.toBeNull();
      await waitFor(() => expect(filas()).toHaveLength(2));
      expect(pedidosBandeja()).toHaveLength(antes + 1);
      expect(pedidosBandeja().at(-1)).toEqual([{ estado: "ABIERTO" }, 1, 25]);
      expect(fila(54)).toHaveAttribute("data-resaltado", "true");
      expect(fila(45)).not.toHaveAttribute("data-resaltado");
      expect(botonNuevo()).toHaveFocus();
      fireEvent.animationEnd(fila(54));
      expect(fila(54)).not.toHaveAttribute("data-resaltado");
    });

    it("entrando directo a /tickets/nuevo, al crear queda en la bandeja con su vista y el aviso", async () => {
      vi.spyOn(tickets, "crear").mockResolvedValue(ticketCreado(54));
      const { persona } = await montar({ ruta: "/tickets/nuevo?estado=ABIERTO" });
      await screen.findByRole("dialog", { name: "Nuevo ticket" });
      await completar(persona);
      await persona.click(botonCrear());
      expect(await screen.findByText("Ticket TQ-000054 creado")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/bandeja");
      expect(parametros()).toEqual({ estado: "ABIERTO" });
    });

    it("el aviso se cierra solo a los 4 s", async () => {
      const reloj = relojFalso();
      await crearDesdeLaBandeja(reloj);
      expect(await screen.findByText("Ticket TQ-000054 creado")).toBeInTheDocument();
      await avanzar(3_000, reloj);
      expect(screen.getByText("Ticket TQ-000054 creado")).toBeInTheDocument();
      await avanzar(1_100, reloj);
      expect(screen.queryByText("Ticket TQ-000054 creado")).not.toBeInTheDocument();
    });
  });
});
