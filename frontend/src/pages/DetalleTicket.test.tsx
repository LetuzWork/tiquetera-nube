import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { tickets, usuarios } from "../api/endpoints";
import type { Comentario, Estado, Evento, Me, Persona, Rol, Ticket } from "../api/types";
import { meDe, paginaDe, ticketResumenDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";

const TITULO = "La impresora del tercer piso no imprime";
const DESCRIPCION = "Desde ayer la impresora del tercer piso no toma ningún trabajo.";

const RESPONSABLES: Persona[] = [
  { usuario: "u.admin", nombre: "Ana Administradora" },
  { usuario: "u.operador", nombre: "Omar Operador" },
];

function accionesDe(rol: Rol): Estado[] {
  return rol === "admin" || rol === "operador" ? ["EN_PROGRESO", "CERRADO"] : [];
}

function ticketDe(cambios: Partial<Ticket> = {}): Ticket {
  return {
    id: "TQ-000045",
    numero: 45,
    titulo: TITULO,
    descripcion: DESCRIPCION,
    categoria: "Hardware",
    estado: "ABIERTO",
    prioridad: "ALTA",
    solicitante: "u.usuario",
    responsable: null,
    creado_en: "2026-11-17T17:05:00Z",
    actualizado_en: "2026-11-17T17:10:00Z",
    comentarios: [],
    historial: [],
    acciones: ["EN_PROGRESO", "CERRADO"],
    ...cambios,
  };
}

const evento = (campo: string, autor: string, fecha: string, anterior: string | null = null, nuevo: string | null = null): Evento => ({
  campo,
  anterior,
  nuevo,
  autor,
  fecha,
});

const comentario = (autor: string, texto: string, creado_en: string): Comentario => ({ autor, texto, creado_en });

function errorDelServidor(estado: number, codigo: string, detalle?: string): ApiError {
  const datos = detalle === undefined ? { codigo } : { codigo, detalle };
  return new ApiError(estado, codigo, detalle ?? "Ocurrió un error inesperado.", datos);
}

function pendiente<T>() {
  let resolver: (valor: T) => void = () => undefined;
  let rechazar: (motivo: unknown) => void = () => undefined;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

interface Opciones {
  rol?: Rol;
  me?: Me;
  ticket?: Ticket | Error | "pendiente";
  ruta?: string;
}

async function montar({ rol = "operador", me = meDe(rol), ticket = ticketDe({ acciones: accionesDe(rol) }), ruta = "/tickets/45" }: Opciones = {}) {
  const obtener = vi.spyOn(tickets, "obtener");
  if (ticket === "pendiente") obtener.mockReturnValue(new Promise<Ticket>(() => undefined));
  else if (ticket instanceof Error) obtener.mockRejectedValue(ticket);
  else obtener.mockResolvedValue(ticket);
  vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
  const app = await renderizarApp({ ruta, me });
  return { ...app, persona: userEvent.setup() };
}

async function montarFicha(opciones: Opciones = {}) {
  const montada = await montar(opciones);
  await screen.findByRole("heading", { level: 1, name: TITULO });
  return montada;
}

const vidrio = () => screen.getByRole("main");
const titulo = () => within(vidrio()).getByRole("heading", { level: 1 });
const propiedades = () => screen.getByRole("group", { name: "Propiedades" });
const control = (nombre: string) => within(propiedades()).getByRole<HTMLSelectElement>("combobox", { name: nombre });
const sinControl = (nombre: string) => within(propiedades()).queryByRole("combobox", { name: nombre });
const opcionesDe = (nombre: string) => within(control(nombre)).getAllByRole("option").map((opcion) => opcion.textContent);
const actividad = () => screen.getByRole("region", { name: "Actividad" });
const entradas = () => within(actividad()).queryAllByRole("listitem");
const campoComentario = () => screen.getByRole("textbox", { name: "Comentario" });
const botonComentar = () => screen.getByRole("button", { name: "Comentar" });
const dialogo = () => screen.getByRole("alertdialog");

function cabecera(): HTMLElement {
  const elemento = titulo().closest("header");
  if (!elemento) throw new Error("El título no está en la cabecera");
  return elemento;
}

function dato(nombre: string): Element {
  const valor = within(propiedades()).getByText(nombre).nextElementSibling;
  if (!valor) throw new Error(`La propiedad ${nombre} no tiene valor`);
  return valor;
}

async function esperarConfirmacion(texto: string) {
  const aviso = await screen.findByText(texto);
  expect(aviso.closest('[role="status"]')).not.toBeNull();
}

function espiarCambios() {
  const pedido = pendiente<Ticket>();
  vi.spyOn(tickets, "cambiarEstado").mockReturnValue(pedido.promesa);
  vi.spyOn(tickets, "asignar").mockReturnValue(pedido.promesa);
  vi.spyOn(tickets, "editar").mockReturnValue(pedido.promesa);
  return pedido;
}

interface CasoCambio {
  propiedad: string;
  elegir: string;
  valor: string;
  anterior: string;
  endpoint: () => unknown;
  argumentos: unknown[];
  respuesta: Partial<Ticket>;
  aviso: string;
}

const CAMBIOS: CasoCambio[] = [
  {
    propiedad: "Estado",
    elegir: "En progreso",
    valor: "EN_PROGRESO",
    anterior: "ABIERTO",
    endpoint: () => tickets.cambiarEstado,
    argumentos: [45, "EN_PROGRESO"],
    respuesta: { estado: "EN_PROGRESO", acciones: ["RESUELTO"] },
    aviso: "Estado actualizado",
  },
  {
    propiedad: "Responsable",
    elegir: "Omar Operador",
    valor: "u.operador",
    anterior: "",
    endpoint: () => tickets.asignar,
    argumentos: [45, "u.operador"],
    respuesta: { responsable: "u.operador" },
    aviso: "Responsable actualizado",
  },
  {
    propiedad: "Prioridad",
    elegir: "Crítica",
    valor: "CRITICA",
    anterior: "ALTA",
    endpoint: () => tickets.editar,
    argumentos: [45, { prioridad: "CRITICA" }],
    respuesta: { prioridad: "CRITICA" },
    aviso: "Prioridad actualizada",
  },
  {
    propiedad: "Categoría",
    elegir: "Red",
    valor: "Red",
    anterior: "Hardware",
    endpoint: () => tickets.editar,
    argumentos: [45, { categoria: "Red" }],
    respuesta: { categoria: "Red" },
    aviso: "Categoría actualizada",
  },
];

describe("DetalleTicket", () => {
  describe("RF-19: cabecera y vuelta a la bandeja", () => {
    it("muestra el número, el título, el estado, la prioridad con su nombre, la descripción y la actividad", async () => {
      await montarFicha();
      const arriba = within(cabecera());
      expect(arriba.getByText("TQ-000045")).toBeInTheDocument();
      expect(titulo()).toHaveTextContent(TITULO);
      expect(arriba.getByText("Abierto").closest("[data-estado]")).toHaveAttribute("data-estado", "ABIERTO");
      expect(arriba.getByText("Prioridad alta").closest("[data-prioridad]")).toHaveAttribute("data-prioridad", "ALTA");
      expect(within(vidrio()).getByRole("heading", { level: 2, name: "Descripción" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Descripción" })).toHaveTextContent(DESCRIPCION);
      expect(within(vidrio()).getByRole("heading", { level: 2, name: "Actividad" })).toBeInTheDocument();
    });

    it("mientras llega el ticket dice 'Cargando el ticket…'", async () => {
      await montar({ ticket: "pendiente" });
      expect(within(vidrio()).getByRole("status")).toHaveTextContent("Cargando el ticket…");
    });

    it("'‹ Tickets' vuelve a la bandeja con la vista que tenía", async () => {
      vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([ticketResumenDe({ numero: 45 })]));
      const { persona } = await montar({ ruta: "/bandeja?q=impresora&estado=ABIERTO&prioridad=ALTA" });
      await persona.click(await within(vidrio()).findByRole("link", { name: new RegExp(TITULO) }));
      await screen.findByRole("heading", { level: 1, name: TITULO });
      expect(window.location.pathname).toBe("/tickets/45");
      await persona.click(within(vidrio()).getByRole("link", { name: "Tickets" }));
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
      expect(window.location.search).toBe("?q=impresora&estado=ABIERTO&prioridad=ALTA");
      expect(await within(vidrio()).findByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
    });

    it("entrando directo al ticket, '‹ Tickets' lleva a /bandeja", async () => {
      const { persona } = await montarFicha();
      const volver = within(vidrio()).getByRole("link", { name: "Tickets" });
      expect(volver).toHaveAttribute("href", "/bandeja");
      await persona.click(volver);
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
      expect(window.location.search).toBe("");
    });
  });

  describe("RF-20: actividad", () => {
    it("mezcla comentarios y eventos del más viejo al más nuevo, sin repetir el evento del comentario", async () => {
      await montarFicha({
        ticket: ticketDe({
          // El historial y los comentarios llegan desordenados a propósito.
          historial: [
            evento("estado", "u.operador", "2026-11-17T13:42:00Z", "ABIERTO", "EN_PROGRESO"),
            evento("creacion", "u.usuario", "2026-11-16T19:06:00Z"),
            evento("comentario", "u.operador", "2026-11-17T14:00:00Z"),
            evento("responsable", "u.admin", "2026-11-17T13:40:00Z", null, "u.operador"),
            evento("responsable", "u.admin", "2026-11-17T13:41:00Z", "u.operador", null),
          ],
          comentarios: [
            comentario("u.operador", "Ya lo estoy viendo.", "2026-11-17T14:00:00Z"),
            comentario("u.usuario", "Sigue sin imprimir.", "2026-11-16T20:30:00Z"),
          ],
        }),
      });
      const lista = entradas();
      expect(lista.map((entrada) => entrada.getAttribute("data-tipo"))).toEqual([
        "evento",
        "comentario",
        "evento",
        "evento",
        "evento",
        "comentario",
      ]);
      expect(lista[0]).toHaveTextContent("u.usuario creó el ticket · 16 nov");
      expect(lista[2]).toHaveTextContent("u.admin asignó a u.operador · 10:40");
      expect(lista[3]).toHaveTextContent("u.admin quitó el responsable · 10:41");
      expect(lista[4]).toHaveTextContent("u.operador cambió el estado de Abierto a En progreso · 10:42");
    });

    it("un comentario muestra autor, hora si es de hoy o fecha corta si no, y el texto", async () => {
      await montarFicha({
        ticket: ticketDe({
          comentarios: [
            comentario("u.usuario", "Sigue sin imprimir.", "2026-11-16T20:30:00Z"),
            comentario("u.operador", "Ya lo estoy viendo.", "2026-11-17T14:00:00Z"),
          ],
        }),
      });
      const [ayer, hoy] = entradas();
      if (!ayer || !hoy) throw new Error("Faltan comentarios");
      expect(within(ayer).getByText("u.usuario")).toBeInTheDocument();
      expect(within(ayer).getByText("16 nov")).toBeInTheDocument();
      expect(within(ayer).getByText("Sigue sin imprimir.")).toBeInTheDocument();
      expect(within(hoy).getByText("u.operador")).toBeInTheDocument();
      expect(within(hoy).getByText("11:00")).toBeInTheDocument();
      expect(within(hoy).getByText("Ya lo estoy viendo.")).toBeInTheDocument();
    });

    it("la fecha corta y la hora siguen la zona del servidor y no la del dispositivo", async () => {
      // 23:30 del 16 en Buenos Aires son las 11:30 del 17 en Tokio.
      await montarFicha({ ticket: ticketDe({ historial: [evento("creacion", "u.usuario", "2026-11-17T02:30:00Z")] }) });
      expect(entradas()[0]).toHaveTextContent("u.usuario creó el ticket · 16 nov");
    });

    it("sin comentarios ni eventos dice 'Todavía no hay actividad.'", async () => {
      await montarFicha();
      expect(within(actividad()).getByText("Todavía no hay actividad.")).toBeInTheDocument();
      expect(entradas()).toHaveLength(0);
    });
  });

  describe("RF-21: comentar", () => {
    it("'Comentar' publica, el comentario aparece en la actividad y el campo se vacía", async () => {
      const pedido = pendiente<Ticket>();
      const comentar = vi.spyOn(tickets, "comentar").mockReturnValue(pedido.promesa);
      const { persona } = await montarFicha();
      await persona.type(campoComentario(), "Ya reinicié la cola de impresión.");
      await persona.click(botonComentar());
      expect(comentar).toHaveBeenCalledWith(45, "Ya reinicié la cola de impresión.");
      expect(botonComentar()).toBeDisabled();
      await act(async () => {
        pedido.resolver(
          ticketDe({ comentarios: [comentario("u.operador", "Ya reinicié la cola de impresión.", "2026-11-17T17:21:00Z")] }),
        );
      });
      expect(await within(actividad()).findByText("Ya reinicié la cola de impresión.")).toBeInTheDocument();
      expect(within(actividad()).getByText("14:21")).toBeInTheDocument();
      expect(campoComentario()).toHaveValue("");
      expect(botonComentar()).toBeEnabled();
    });

    it.each([
      ["Ctrl+Enter", "{Control>}{Enter}{/Control}"],
      ["⌘+Enter", "{Meta>}{Enter}{/Meta}"],
    ])("%s también envía", async (_atajo, teclas) => {
      const comentar = vi.spyOn(tickets, "comentar").mockResolvedValue(ticketDe());
      const { persona } = await montarFicha();
      await persona.type(campoComentario(), "Probé con otro cable.");
      await persona.keyboard(teclas);
      expect(comentar).toHaveBeenCalledWith(45, "Probé con otro cable.");
    });

    it("Enter solo no envía: agrega un renglón", async () => {
      const comentar = vi.spyOn(tickets, "comentar").mockResolvedValue(ticketDe());
      const { persona } = await montarFicha();
      await persona.type(campoComentario(), "Primero{Enter}Segundo");
      expect(comentar).not.toHaveBeenCalled();
      expect(campoComentario()).toHaveValue("Primero\nSegundo");
    });

    it.each([
      ["vacío", ""],
      ["solo espacios", "   "],
    ])("%s no envía y dice 'Escribí un comentario.'", async (_caso, texto) => {
      const comentar = vi.spyOn(tickets, "comentar").mockResolvedValue(ticketDe());
      const { persona } = await montarFicha();
      if (texto !== "") await persona.type(campoComentario(), texto);
      await persona.click(botonComentar());
      expect(comentar).not.toHaveBeenCalled();
      expect(screen.getByText("Escribí un comentario.")).toBeInTheDocument();
      expect(campoComentario()).toHaveAttribute("aria-invalid", "true");
      expect(campoComentario()).toHaveAccessibleDescription(/Escribí un comentario\./);
      expect(campoComentario()).toHaveFocus();
    });

    it("si falla, el texto queda y dice 'No se pudo publicar el comentario.'", async () => {
      vi.spyOn(tickets, "comentar").mockRejectedValue(errorDelServidor(500, "ERROR"));
      const { persona } = await montarFicha();
      await persona.type(campoComentario(), "Ya reinicié la cola de impresión.");
      await persona.click(botonComentar());
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo publicar el comentario.");
      expect(campoComentario()).toHaveValue("Ya reinicié la cola de impresión.");
      expect(entradas()).toHaveLength(0);
    });

    it.each<[Rol, boolean]>([
      ["admin", true],
      ["operador", true],
      ["usuario", true],
      ["consulta", false],
    ])("con el rol %s, el redactor está: %s", async (rol, conRedactor) => {
      await montarFicha({ rol });
      expect(screen.queryByRole("textbox", { name: "Comentario" }) !== null).toBe(conRedactor);
      expect(screen.queryByRole("button", { name: "Comentar" }) !== null).toBe(conRedactor);
    });

    it("sin ticket:comentar no hay redactor aunque tenga otros permisos", async () => {
      const permisos = meDe("operador").permisos.filter((permiso) => permiso !== "ticket:comentar");
      await montarFicha({ me: meDe("operador", { permisos }) });
      expect(screen.queryByRole("textbox", { name: "Comentario" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Comentar" })).not.toBeInTheDocument();
      expect(control("Estado")).toBeInTheDocument();
    });
  });

  describe("RF-22: propiedades según los permisos", () => {
    it.each<[Rol, boolean]>([
      ["admin", true],
      ["operador", true],
      ["usuario", false],
      ["consulta", false],
    ])("con el rol %s, las propiedades se editan: %s", async (rol, editables) => {
      await montarFicha({ rol, ticket: ticketDe({ acciones: accionesDe(rol), responsable: "u.operador" }) });
      for (const nombre of ["Estado", "Responsable", "Prioridad", "Categoría"]) {
        expect(sinControl(nombre) !== null).toBe(editables);
      }
      if (editables) return;
      expect(dato("Estado")).toHaveTextContent("Abierto");
      expect(dato("Responsable")).toHaveTextContent("u.operador");
      expect(dato("Prioridad")).toHaveTextContent("Alta");
      expect(dato("Categoría")).toHaveTextContent("Hardware");
    });

    it("el estado ofrece el actual y solo los de acciones", async () => {
      await montarFicha({ ticket: ticketDe({ estado: "RESUELTO", acciones: ["EN_PROGRESO", "CERRADO"] }) });
      expect(opcionesDe("Estado")).toEqual(["En progreso", "Resuelto", "Cerrado"]);
      expect(control("Estado")).toHaveValue("RESUELTO");
    });

    it("el responsable ofrece 'Sin asignar' y la lista de responsables, con el nombre", async () => {
      await montarFicha({ ticket: ticketDe({ responsable: "u.operador" }) });
      expect(opcionesDe("Responsable")).toEqual(["Sin asignar", "Ana Administradora", "Omar Operador"]);
      expect(control("Responsable")).toHaveValue("u.operador");
      expect(control("Responsable")).toHaveDisplayValue("Omar Operador");
    });

    it("sin responsable, el selector muestra 'Sin asignar'", async () => {
      await montarFicha();
      expect(control("Responsable")).toHaveDisplayValue("Sin asignar");
    });

    it("prioridad y categoría ofrecen sus valores con el nombre", async () => {
      await montarFicha();
      expect(opcionesDe("Prioridad")).toEqual(["Baja", "Media", "Alta", "Crítica"]);
      expect(control("Prioridad")).toHaveDisplayValue("Alta");
      expect(opcionesDe("Categoría")).toEqual(["Hardware", "Software", "Red", "Accesos", "Otro"]);
      expect(control("Categoría")).toHaveDisplayValue("Hardware");
    });

    it("muestra Solicitante, Creado y Actualizado con fecha y hora en la zona del servidor", async () => {
      await montarFicha({ ticket: ticketDe({ creado_en: "2026-11-17T02:30:00Z", actualizado_en: "2026-11-17T17:10:00Z" }) });
      expect(dato("Solicitante")).toHaveTextContent("u.usuario");
      expect(dato("Creado")).toHaveTextContent("16 nov, 23:30");
      expect(dato("Actualizado")).toHaveTextContent("17 nov, 14:10");
    });

    it("sin ticket:asignar, el responsable se ve como texto y sin responsable dice 'Sin asignar'", async () => {
      await montarFicha({ rol: "usuario" });
      expect(dato("Responsable")).toHaveTextContent("Sin asignar");
    });
  });

  describe("RF-23: guardar al cambiar", () => {
    it.each(CAMBIOS)("$propiedad: llama a su endpoint, deshabilita el control y confirma con $aviso", async (caso) => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control(caso.propiedad), caso.elegir);
      expect(caso.endpoint()).toHaveBeenCalledTimes(1);
      expect(caso.endpoint()).toHaveBeenCalledWith(...caso.argumentos);
      expect(control(caso.propiedad)).toBeDisabled();
      expect(control(caso.propiedad)).toHaveValue(caso.valor);
      await act(async () => {
        pedido.resolver(ticketDe(caso.respuesta));
      });
      await esperarConfirmacion(caso.aviso);
      expect(control(caso.propiedad)).toBeEnabled();
      expect(control(caso.propiedad)).toHaveValue(caso.valor);
    });

    it("la actividad y las acciones se actualizan con la respuesta", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Estado"), "En progreso");
      await act(async () => {
        pedido.resolver(
          ticketDe({
            estado: "EN_PROGRESO",
            acciones: ["RESUELTO"],
            historial: [evento("estado", "u.operador", "2026-11-17T17:20:30Z", "ABIERTO", "EN_PROGRESO")],
          }),
        );
      });
      await esperarConfirmacion("Estado actualizado");
      expect(opcionesDe("Estado")).toEqual(["En progreso", "Resuelto"]);
      expect(entradas()[0]).toHaveTextContent("u.operador cambió el estado de Abierto a En progreso · 14:20");
      expect(within(cabecera()).getByText("En progreso")).toBeInTheDocument();
    });

    it("quitar el responsable manda null", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha({ ticket: ticketDe({ responsable: "u.operador" }) });
      await persona.selectOptions(control("Responsable"), "Sin asignar");
      expect(tickets.asignar).toHaveBeenCalledWith(45, null);
      await act(async () => {
        pedido.resolver(ticketDe({ responsable: null }));
      });
      await esperarConfirmacion("Responsable actualizado");
      expect(control("Responsable")).toHaveDisplayValue("Sin asignar");
    });

    it("dos cambios seguidos: el segundo sale cuando responde el primero", async () => {
      const primero = pendiente<Ticket>();
      const segundo = pendiente<Ticket>();
      const editar = vi.spyOn(tickets, "editar").mockReturnValueOnce(primero.promesa).mockReturnValueOnce(segundo.promesa);
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Prioridad"), "Crítica");
      await persona.selectOptions(control("Categoría"), "Red");
      expect(editar).toHaveBeenCalledTimes(1);
      expect(editar).toHaveBeenLastCalledWith(45, { prioridad: "CRITICA" });
      expect(control("Categoría")).toHaveValue("Red");
      await act(async () => {
        primero.resolver(ticketDe({ prioridad: "CRITICA" }));
      });
      await waitFor(() => expect(editar).toHaveBeenCalledTimes(2));
      expect(editar).toHaveBeenLastCalledWith(45, { categoria: "Red" });
      expect(control("Categoría")).toHaveValue("Red");
      await act(async () => {
        segundo.resolver(ticketDe({ prioridad: "CRITICA", categoria: "Red" }));
      });
      await esperarConfirmacion("Categoría actualizada");
      expect(control("Prioridad")).toHaveValue("CRITICA");
      expect(control("Categoría")).toHaveValue("Red");
    });
  });

  describe("RF-24: si guardar falla", () => {
    it.each(CAMBIOS)("$propiedad: vuelve al valor anterior y muestra el detalle del servidor", async (caso) => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control(caso.propiedad), caso.elegir);
      expect(control(caso.propiedad)).toHaveValue(caso.valor);
      await act(async () => {
        pedido.rechazar(errorDelServidor(409, "TICKET_ARCHIVADO", "El ticket está archivado y no admite cambios."));
      });
      expect(await screen.findByRole("alert")).toHaveTextContent("El ticket está archivado y no admite cambios.");
      expect(control(caso.propiedad)).toHaveValue(caso.anterior);
      expect(control(caso.propiedad)).toBeEnabled();
      expect(screen.queryByText(caso.aviso)).not.toBeInTheDocument();
    });

    it.each([
      ["un ApiError sin detalle", errorDelServidor(422, "ENTRADA_INVALIDA")],
      ["un error que no es ApiError", new TypeError("Failed to fetch")],
    ])("con %s dice 'No se pudo aplicar el cambio.'", async (_caso, error) => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Prioridad"), "Baja");
      await act(async () => {
        pedido.rechazar(error);
      });
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo aplicar el cambio.");
      expect(control("Prioridad")).toHaveValue("ALTA");
    });

    it("por el camino real del cliente, el aviso lleva el detalle que mandó el servidor", async () => {
      const detalle = "No se puede pasar de ABIERTO a EN_PROGRESO.";
      const { persona } = await montarFicha();
      vi.spyOn(globalThis, "fetch").mockImplementation(
        async () => new Response(JSON.stringify({ codigo: "TRANSICION_INVALIDA", detalle }), { status: 409 }),
      );
      await persona.selectOptions(control("Estado"), "En progreso");
      expect(await screen.findByRole("alert")).toHaveTextContent(detalle);
      expect(control("Estado")).toHaveValue("ABIERTO");
    });

    it("una caída de sesión (401) no suma un aviso de error: la atiende la 001", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Prioridad"), "Baja");
      await act(async () => {
        pedido.rechazar(errorDelServidor(401, "SESION_INVALIDA", "La sesión no es válida o expiró."));
      });
      await waitFor(() => expect(control("Prioridad")).toHaveValue("ALTA"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("RF-25: confirmar el cierre", () => {
    it("elegir 'Cerrado' pide confirmación con el foco en 'Cancelar' y todavía no guarda", async () => {
      const cambiarEstado = vi.spyOn(tickets, "cambiarEstado");
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Estado"), "Cerrado");
      expect(dialogo()).toHaveAccessibleName("¿Cerrar TQ-000045?");
      expect(dialogo()).toHaveAccessibleDescription("Solo un administrador puede reabrirlo.");
      expect(within(dialogo()).getByRole("button", { name: "Cancelar" })).toHaveFocus();
      expect(within(dialogo()).getByRole("button", { name: "Cerrar ticket" })).toBeInTheDocument();
      expect(cambiarEstado).not.toHaveBeenCalled();
      expect(control("Estado")).toHaveValue("ABIERTO");
    });

    it("'Cancelar' deja el estado como estaba", async () => {
      const cambiarEstado = vi.spyOn(tickets, "cambiarEstado");
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Estado"), "Cerrado");
      await persona.click(within(dialogo()).getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(control("Estado")).toHaveValue("ABIERTO");
      expect(control("Estado")).toBeEnabled();
      expect(control("Estado")).toHaveFocus();
      expect(cambiarEstado).not.toHaveBeenCalled();
    });

    it("Esc deja el estado como estaba", async () => {
      const cambiarEstado = vi.spyOn(tickets, "cambiarEstado");
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Estado"), "Cerrado");
      await persona.keyboard("{Escape}");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(control("Estado")).toHaveValue("ABIERTO");
      expect(control("Estado")).toHaveFocus();
      expect(cambiarEstado).not.toHaveBeenCalled();
    });

    it("'Cerrar ticket' lo cierra y confirma 'Estado actualizado'", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha();
      await persona.selectOptions(control("Estado"), "Cerrado");
      await persona.click(within(dialogo()).getByRole("button", { name: "Cerrar ticket" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(tickets.cambiarEstado).toHaveBeenCalledWith(45, "CERRADO");
      expect(control("Estado")).toBeDisabled();
      expect(control("Estado")).toHaveValue("CERRADO");
      await act(async () => {
        pedido.resolver(ticketDe({ estado: "CERRADO", acciones: [] }));
      });
      await esperarConfirmacion("Estado actualizado");
      expect(sinControl("Estado")).not.toBeInTheDocument();
      expect(dato("Estado")).toHaveTextContent("Cerrado");
    });

    it("RNF-3: si el selector de Estado pasa a texto, el foco va al texto 'Cerrado', fuera del orden de tabulación", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha({ rol: "operador" });
      await persona.selectOptions(control("Estado"), "Cerrado");
      await persona.click(within(dialogo()).getByRole("button", { name: "Cerrar ticket" }));
      await act(async () => {
        pedido.resolver(ticketDe({ estado: "CERRADO", acciones: [] }));
      });
      await esperarConfirmacion("Estado actualizado");
      expect(sinControl("Estado")).not.toBeInTheDocument();
      expect(dato("Estado")).toHaveTextContent("Cerrado");
      expect(dato("Estado")).toHaveAttribute("tabindex", "-1");
      expect(dato("Estado")).toHaveFocus();
    });

    it("RNF-3: el Admin conserva el selector y el foco vuelve a él", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha({ rol: "admin" });
      await persona.selectOptions(control("Estado"), "Cerrado");
      await persona.click(within(dialogo()).getByRole("button", { name: "Cerrar ticket" }));
      await act(async () => {
        pedido.resolver(ticketDe({ estado: "CERRADO", acciones: ["EN_PROGRESO"] }));
      });
      await esperarConfirmacion("Estado actualizado");
      expect(control("Estado")).toHaveValue("CERRADO");
      expect(control("Estado")).toBeEnabled();
      expect(control("Estado")).toHaveFocus();
    });
  });

  describe("caso límite: un ticket Cerrado", () => {
    it("el Admin ve el selector para reabrirlo, sin confirmación", async () => {
      const pedido = espiarCambios();
      const { persona } = await montarFicha({ rol: "admin", ticket: ticketDe({ estado: "CERRADO", acciones: ["EN_PROGRESO"] }) });
      expect(opcionesDe("Estado")).toEqual(["En progreso", "Cerrado"]);
      expect(control("Estado")).toHaveValue("CERRADO");
      await persona.selectOptions(control("Estado"), "En progreso");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(tickets.cambiarEstado).toHaveBeenCalledWith(45, "EN_PROGRESO");
      await act(async () => {
        pedido.resolver(ticketDe({ estado: "EN_PROGRESO", acciones: ["RESUELTO"] }));
      });
      await esperarConfirmacion("Estado actualizado");
    });

    it.each<Rol>(["operador", "usuario", "consulta"])("con el rol %s, el estado se ve como texto", async (rol) => {
      await montarFicha({ rol, ticket: ticketDe({ estado: "CERRADO", acciones: [] }) });
      expect(sinControl("Estado")).not.toBeInTheDocument();
      expect(dato("Estado")).toHaveTextContent("Cerrado");
    });
  });

  describe("RF-26: el ticket no se pudo abrir", () => {
    it.each([
      ["no existe (404)", errorDelServidor(404, "TICKET_NO_ENCONTRADO", "El ticket no existe."), "Este ticket no existe."],
      ["sin acceso (403)", errorDelServidor(403, "PERMISO_DENEGADO", "No tenés permiso para esta acción."), "No tenés acceso a este ticket."],
    ])("%s: lo dice con 'Volver a Tickets'", async (_caso, error, texto) => {
      const { persona } = await montar({ ticket: error });
      expect(await within(vidrio()).findByRole("heading", { level: 1, name: texto })).toBeInTheDocument();
      const volver = within(vidrio()).getByRole("link", { name: "Volver a Tickets" });
      expect(volver).toHaveAttribute("href", "/bandeja");
      expect(screen.queryByRole("group", { name: "Propiedades" })).not.toBeInTheDocument();
      await persona.click(volver);
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
    });

    it("un número que no es número no consulta y dice 'Este ticket no existe.'", async () => {
      await montar({ ruta: "/tickets/abc" });
      expect(await within(vidrio()).findByRole("heading", { level: 1, name: "Este ticket no existe." })).toBeInTheDocument();
      expect(tickets.obtener).not.toHaveBeenCalled();
    });

    it("otro error dice 'No se pudo cargar el ticket.' y 'Reintentar' lo vuelve a pedir", async () => {
      const { persona } = await montar({ ticket: errorDelServidor(0, "SIN_CONEXION", "No se pudo contactar al servidor.") });
      expect(await within(vidrio()).findByRole("heading", { name: "No se pudo cargar el ticket." })).toBeInTheDocument();
      expect(within(vidrio()).getByRole("link", { name: "Tickets" })).toBeInTheDocument();
      vi.mocked(tickets.obtener).mockResolvedValue(ticketDe());
      await persona.click(within(vidrio()).getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("heading", { level: 1, name: TITULO })).toBeInTheDocument();
      expect(tickets.obtener).toHaveBeenCalledTimes(2);
      expect(tickets.obtener).toHaveBeenLastCalledWith(45);
    });
  });
});
