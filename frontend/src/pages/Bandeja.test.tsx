import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, EVENTO_SESION_CAIDA } from "../api/client";
import { tickets, usuarios } from "../api/endpoints";
import type { Filtros, Me, Pagina, Persona, Rol, Ticket, TicketResumen } from "../api/types";
import { horarioDe, meDe, paginaDe, ticketResumenDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";
import { avanzar, cambiarVisibilidad, relojFalso, type RelojFalso } from "../test/tiempo";

// Miércoles 18 de noviembre, 17:00 en Buenos Aires.
const AHORA = "2026-11-18T20:00:00Z";
const HOY = "2026-11-18";
const A_LAS_1606 = "2026-11-18T19:06:00Z";
const A_LAS_0006 = "2026-11-18T03:06:00Z";
// 20:30 del 17 en Buenos Aires; en Tokio, la zona del dispositivo en las pruebas, ya es el 18.
const AYER_2030 = "2026-11-17T23:30:00Z";
const HACE_UNA_SEMANA = "2026-11-10T15:00:00Z";
const MINUTO = 60_000;
const POR_PAGINA = 25;

const RESPONSABLES: Persona[] = [
  { usuario: "u.operador", nombre: "Omar Operador" },
  { usuario: "u.admin", nombre: "Ana Administradora" },
];

const FUERA_DE_HORARIO = { codigo: "SESION_FUERA_DE_HORARIO", detalle: "La franja horaria cerró y la sesión caducó." };

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

type RespuestaBandeja = Pagina | Error | ((filtros: Filtros, pagina: number) => Pagina);

interface Opciones {
  ruta?: string;
  me?: Me;
  bandeja?: RespuestaBandeja;
  deHoy?: Pagina | Error;
  reloj?: RelojFalso;
}

const cuenta = (rol: Rol) => meDe(rol, { sesion_expira: "2026-11-18T18:00:00-03:00", segundos_restantes: 3600 });

const ticket = (numero: number, cambios: Partial<TicketResumen> = {}) =>
  ticketResumenDe({ numero, creado_en: AYER_2030, ...cambios });

const pagina = (items: TicketResumen[], cambios: Partial<Pagina> = {}) => paginaDe(items, { por_pagina: POR_PAGINA, ...cambios });

function paginaDeMuchos(numeroPagina: number, total: number): Pagina {
  const primero = (numeroPagina - 1) * POR_PAGINA;
  const cantidad = Math.max(0, Math.min(POR_PAGINA, total - primero));
  const items = Array.from({ length: cantidad }, (_, i) => ticket(total - primero - i));
  return pagina(items, { total, pagina: numeroPagina });
}

function ticketCompleto(numero: number): Ticket {
  return { ...ticket(numero), descripcion: `Detalle del ticket ${numero}.`, comentarios: [], historial: [], acciones: [] };
}

function servidor({ bandeja = pagina([]), deHoy = pagina([]) }: Pick<Opciones, "bandeja" | "deHoy">) {
  vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
  vi.spyOn(tickets, "listar").mockImplementation(async (filtros, numeroPagina = 1, porPagina = 20) => {
    if (porPagina !== POR_PAGINA) {
      if (deHoy instanceof Error) throw deHoy;
      return deHoy;
    }
    if (bandeja instanceof Error) throw bandeja;
    return typeof bandeja === "function" ? bandeja(filtros, numeroPagina) : bandeja;
  });
}

async function montar({ ruta = "/bandeja", me = cuenta("operador"), reloj = relojFalso(), ...datos }: Opciones = {}) {
  servidor(datos);
  const app = await renderizarApp({ ruta, me, horario: horarioDe(AHORA), reloj });
  return { ...app, persona: userEvent.setup() };
}

const vidrio = () => within(screen.getByRole("main"));
const buscador = () => vidrio().getByRole("searchbox", { name: "Buscar tickets" });
const estados = () => vidrio().getByRole("radiogroup", { name: "Estado" });
const opcionEstado = (nombre: string) => within(estados()).getByRole("radio", { name: nombre });
const botonFiltros = () => vidrio().getByRole("button", { name: /^Filtros/ });
const selector = (nombre: string) => vidrio().getByRole("combobox", { name: nombre });
const casillaMios = () => vidrio().queryByRole("checkbox", { name: "Solo los asignados a mí" });
const botonNuevo = () => vidrio().queryByRole("link", { name: "Nuevo ticket" });

const pedidosBandeja = () => vi.mocked(tickets.listar).mock.calls.filter(([, , porPagina]) => porPagina === POR_PAGINA);
const ultimoPedido = () => pedidosBandeja().at(-1);
const parametros = () => Object.fromEntries(new URLSearchParams(window.location.search));

function filas(): HTMLElement[] {
  return vidrio()
    .queryAllByRole("link")
    .filter((enlace) => /^\/tickets\/\d+$/.test(enlace.getAttribute("href") ?? ""));
}

const enlaces = (elementos: HTMLElement[] = filas()) => elementos.map((enlace) => enlace.getAttribute("href"));

function fila(numero: number): HTMLElement {
  const encontrada = filas().find((enlace) => enlace.getAttribute("href") === `/tickets/${numero}`);
  if (!encontrada) throw new Error(`No está la fila de TQ-${numero}`);
  return encontrada;
}

async function esperarFilas(cantidad: number) {
  await waitFor(() => expect(filas()).toHaveLength(cantidad));
}

async function esperarPie(texto: string) {
  expect(await vidrio().findByText(texto)).toBeInTheDocument();
}

describe("Bandeja", () => {
  describe("RF-1: la pantalla", () => {
    it("muestra el título, la búsqueda, el estado, 'Filtros', la lista y el pie, y pide 25 por página", async () => {
      await montar({ bandeja: pagina([ticket(45), ticket(44)]) });
      await esperarPie("1–2 de 2");
      expect(vidrio().getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
      expect(buscador()).toHaveAttribute("placeholder", "Buscar por número o título");
      expect(within(estados()).getAllByRole("radio").map((opcion) => opcion.textContent)).toEqual([
        "Todos",
        "Abiertos",
        "En progreso",
        "Resueltos",
        "Cerrados",
      ]);
      expect(opcionEstado("Todos")).toBeChecked();
      expect(botonFiltros()).toHaveAccessibleName("Filtros");
      expect(botonFiltros()).toHaveAttribute("aria-expanded", "false");
      expect(enlaces()).toEqual(["/tickets/45", "/tickets/44"]);
      expect(pedidosBandeja()).toEqual([[{}, 1, 25]]);
    });

    it("respeta el orden que devuelve el servidor", async () => {
      await montar({ bandeja: pagina([ticket(44), ticket(46), ticket(45)]) });
      await esperarFilas(3);
      expect(enlaces()).toEqual(["/tickets/44", "/tickets/46", "/tickets/45"]);
    });
  });

  describe("RF-2: el resumen sale de los tickets de hoy", () => {
    const deHoy = (cambios: Partial<TicketResumen>[]) =>
      pagina(cambios.map((cambio, i) => ticket(100 + i, { creado_en: A_LAS_1606, ...cambio })));

    it.each<{ caso: string; respuesta: Pagina; texto: string }>([
      { caso: "cero", respuesta: pagina([]), texto: "Hoy no entró ningún ticket." },
      { caso: "uno sin tomar", respuesta: deHoy([{}]), texto: "1 entró hoy y 1 sigue sin tomar." },
      {
        caso: "varios",
        respuesta: deHoy([{}, {}, {}, { responsable: "u.operador" }, { estado: "EN_PROGRESO" }]),
        texto: "5 entraron hoy y 3 siguen sin tomar.",
      },
      {
        caso: "ninguno sin tomar",
        respuesta: deHoy([{ responsable: "u.operador" }, { estado: "RESUELTO", responsable: "u.admin" }]),
        texto: "2 entraron hoy y ninguno sigue sin tomar.",
      },
    ])("con $caso: '$texto'", async ({ respuesta, texto }) => {
      await montar({ bandeja: pagina([ticket(45)]), deHoy: respuesta });
      expect(await vidrio().findByText(texto)).toBeInTheDocument();
      expect(tickets.listar).toHaveBeenCalledWith({ desde: HOY, hasta: HOY }, 1, 100);
    });

    it("cuenta los de hoy y no la página de la bandeja", async () => {
      const bandeja = pagina([
        ticket(47, { creado_en: A_LAS_1606, responsable: "u.operador" }),
        ticket(46, { responsable: "u.admin" }),
        ticket(45, { estado: "RESUELTO" }),
      ]);
      await montar({ bandeja, deHoy: deHoy([{ numero: 48 }]) });
      expect(await vidrio().findByText("1 entró hoy y 1 sigue sin tomar.")).toBeInTheDocument();
      await esperarFilas(3);
    });

    it("si la consulta de hoy falla, no hay resumen", async () => {
      await montar({ bandeja: pagina([ticket(45)]), deHoy: sinConexion() });
      await esperarFilas(1);
      expect(vidrio().getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
      expect(vidrio().queryByText(/entr(ó|aron) hoy|no entró ningún ticket/)).not.toBeInTheDocument();
    });

    it("con el rol Usuario, cuenta lo que le devuelve el servidor: solo los suyos", async () => {
      const suyos = deHoy([{ solicitante: "u.usuario" }, { solicitante: "u.usuario", responsable: "u.operador" }]);
      await montar({ me: cuenta("usuario"), bandeja: pagina([ticket(45)]), deHoy: suyos });
      expect(await vidrio().findByText("2 entraron hoy y 1 sigue sin tomar.")).toBeInTheDocument();
    });
  });

  describe("RF-3: grupos 'Hoy' y 'Anteriores'", () => {
    it("agrupa por la fecha del servidor, con la cantidad al lado; el de las 00:06 va en Hoy", async () => {
      await montar({
        bandeja: pagina([
          ticket(50, { creado_en: A_LAS_1606 }),
          ticket(49, { creado_en: A_LAS_0006 }),
          ticket(48, { creado_en: AYER_2030 }),
          ticket(47, { creado_en: HACE_UNA_SEMANA }),
        ]),
      });
      await esperarFilas(4);
      const hoy = vidrio().getByRole("region", { name: /^Hoy/ });
      const anteriores = vidrio().getByRole("region", { name: /^Anteriores/ });
      const tituloHoy = within(hoy).getByRole("heading", { level: 2 });
      const tituloAnteriores = within(anteriores).getByRole("heading", { level: 2 });
      expect(within(tituloHoy).getByText("Hoy")).toBeInTheDocument();
      expect(within(tituloHoy).getByText("2")).toBeInTheDocument();
      expect(within(tituloAnteriores).getByText("Anteriores")).toBeInTheDocument();
      expect(within(tituloAnteriores).getByText("2")).toBeInTheDocument();
      expect(enlaces(within(hoy).getAllByRole("link"))).toEqual(["/tickets/50", "/tickets/49"]);
      expect(enlaces(within(anteriores).getAllByRole("link"))).toEqual(["/tickets/48", "/tickets/47"]);
    });

    it("no muestra un grupo vacío", async () => {
      await montar({ bandeja: pagina([ticket(48), ticket(47, { creado_en: HACE_UNA_SEMANA })]) });
      await esperarFilas(2);
      expect(vidrio().queryByRole("heading", { level: 2, name: /^Hoy/ })).not.toBeInTheDocument();
      expect(vidrio().getByRole("heading", { level: 2, name: /^Anteriores/ })).toBeInTheDocument();
    });
  });

  describe("RF-4: cada fila", () => {
    it("muestra la hora si es de hoy y la fecha corta si es anterior, en la zona del servidor", async () => {
      await montar({
        bandeja: pagina([
          ticket(50, { creado_en: A_LAS_1606 }),
          ticket(49, { creado_en: A_LAS_0006 }),
          ticket(48, { creado_en: AYER_2030 }),
          ticket(47, { creado_en: HACE_UNA_SEMANA }),
        ]),
      });
      await esperarFilas(4);
      expect(within(fila(50)).getByText("16:06")).toBeInTheDocument();
      expect(within(fila(49)).getByText("00:06")).toBeInTheDocument();
      expect(within(fila(48)).getByText("17 nov")).toBeInTheDocument();
      expect(within(fila(47)).getByText("10 nov")).toBeInTheDocument();
    });

    it.each<[TicketResumen["prioridad"], string, string]>([
      ["BAJA", "", "Prioridad baja"],
      ["MEDIA", "!", "Prioridad media"],
      ["ALTA", "!!", "Prioridad alta"],
      ["CRITICA", "!!!", "Prioridad crítica"],
    ])("la prioridad %s lleva la marca '%s' oculta y el nombre accesible '%s'", async (prioridad, marca, nombre) => {
      await montar({ bandeja: pagina([ticket(45, { prioridad })]) });
      await esperarFilas(1);
      const enFila = within(fila(45));
      expect(enFila.getByText(nombre)).toBeInTheDocument();
      expect(fila(45)).toHaveAccessibleName(new RegExp(nombre));
      expect(fila(45)).not.toHaveAccessibleName(/!/);
      if (marca === "") expect(enFila.queryByText(/^!+$/)).not.toBeInTheDocument();
      else expect(enFila.getByText(marca)).toHaveAttribute("aria-hidden", "true");
    });

    it("muestra el título y debajo el número, la categoría y quién lo pidió", async () => {
      await montar({ bandeja: pagina([ticket(5, { categoria: "Red", titulo: "No anda la VPN" })]) });
      await esperarFilas(1);
      expect(within(fila(5)).getByText("No anda la VPN")).toBeInTheDocument();
      expect(within(fila(5)).getByText("TQ-000005 Red, lo pidió u.usuario")).toBeInTheDocument();
    });

    it("muestra el estado con su nombre y 'Sin asignar' cuando no hay responsable", async () => {
      await montar({
        bandeja: pagina([
          ticket(4, { estado: "ABIERTO" }),
          ticket(3, { estado: "EN_PROGRESO" }),
          ticket(2, { estado: "RESUELTO" }),
          ticket(1, { estado: "CERRADO" }),
        ]),
      });
      await esperarFilas(4);
      expect(within(fila(4)).getByText("Abierto")).toBeInTheDocument();
      expect(within(fila(3)).getByText("En progreso")).toBeInTheDocument();
      expect(within(fila(2)).getByText("Resuelto")).toBeInTheDocument();
      expect(within(fila(1)).getByText("Cerrado")).toBeInTheDocument();
      for (const numero of [4, 3, 2, 1]) expect(within(fila(numero)).getByText("Sin asignar")).toBeInTheDocument();
    });

    it("con 'ticket:asignar', el responsable va con sus iniciales y su nombre", async () => {
      await montar({ bandeja: pagina([ticket(45, { responsable: "u.admin" })]) });
      await waitFor(() => expect(within(fila(45)).getByText("Ana Administradora")).toBeInTheDocument());
      expect(within(fila(45)).getByText("AA")).toHaveAttribute("aria-hidden", "true");
      expect(within(fila(45)).queryByText("Sin asignar")).not.toBeInTheDocument();
      expect(usuarios.responsables).toHaveBeenCalled();
    });

    it("sin 'ticket:asignar', el responsable se muestra como usuario", async () => {
      await montar({ me: cuenta("usuario"), bandeja: pagina([ticket(45, { responsable: "u.operador" })]) });
      await esperarFilas(1);
      expect(within(fila(45)).getByText("u.operador")).toBeInTheDocument();
      expect(within(fila(45)).queryByText("Omar Operador")).not.toBeInTheDocument();
      expect(usuarios.responsables).not.toHaveBeenCalled();
    });

    it("la fila es un enlace al detalle", async () => {
      vi.spyOn(tickets, "obtener").mockResolvedValue(ticketCompleto(45));
      const { persona } = await montar({ bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(fila(45)).toHaveAttribute("href", "/tickets/45");
      await persona.click(fila(45));
      expect(window.location.pathname).toBe("/tickets/45");
      expect(await vidrio().findByRole("heading", { level: 1, name: "La impresora del tercer piso no imprime" })).toBeInTheDocument();
    });
  });

  describe("RF-5: búsqueda", () => {
    it("consulta 300 ms después de la última tecla y vuelve a la página 1", async () => {
      await montar({ ruta: "/bandeja?pagina=2", bandeja: (_filtros, n) => paginaDeMuchos(n, 60) });
      await esperarPie("26–50 de 60");
      expect(buscador()).toHaveAccessibleName("Buscar tickets");
      // Relojes falsos puros para medir los 300 ms justos; user-event no anda con ellos, así que se escribe con fireEvent.
      vi.useFakeTimers();
      const antes = pedidosBandeja().length;
      fireEvent.change(buscador(), { target: { value: "v" } });
      fireEvent.change(buscador(), { target: { value: "vp" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      fireEvent.change(buscador(), { target: { value: "vpn" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
      });
      expect(pedidosBandeja()).toHaveLength(antes);
      expect(parametros()).toEqual({ pagina: "2" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(pedidosBandeja()).toHaveLength(antes + 1);
      expect(ultimoPedido()).toEqual([{ q: "vpn" }, 1, 25]);
      expect(parametros()).toEqual({ q: "vpn" });
    });

    it("Esc borra la búsqueda y consulta sin ella", async () => {
      const { persona } = await montar({ ruta: "/bandeja?q=vpn", bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(buscador()).toHaveValue("vpn");
      expect(ultimoPedido()).toEqual([{ q: "vpn" }, 1, 25]);
      await persona.click(buscador());
      await persona.keyboard("{Escape}");
      expect(buscador()).toHaveValue("");
      expect(parametros()).toEqual({});
      await waitFor(() => expect(ultimoPedido()).toEqual([{}, 1, 25]));
    });

    it("'/' enfoca la búsqueda cuando el foco no está en un campo de texto", async () => {
      const { persona } = await montar({ bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(buscador()).not.toHaveFocus();
      await persona.keyboard("/");
      expect(buscador()).toHaveFocus();
      expect(buscador()).toHaveValue("");
      act(() => fila(45).focus());
      await persona.keyboard("/");
      expect(buscador()).toHaveFocus();
      await persona.keyboard("/");
      expect(buscador()).toHaveValue("/");
    });

    it("'/' no saca el foco de otro campo", async () => {
      const { persona } = await montar({ bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      await persona.click(botonFiltros());
      act(() => selector("Prioridad").focus());
      await persona.keyboard("/");
      expect(selector("Prioridad")).toHaveFocus();
      expect(buscador()).not.toHaveFocus();
    });
  });

  describe("RF-6: el estado como control segmentado", () => {
    it("se recorre con flechas, Inicio y Fin, y cada opción filtra desde la página 1", async () => {
      const { persona } = await montar({ ruta: "/bandeja?pagina=2", bandeja: (_filtros, n) => paginaDeMuchos(n, 60) });
      await esperarPie("26–50 de 60");
      expect(opcionEstado("Todos")).toHaveAttribute("tabindex", "0");
      expect(opcionEstado("Abiertos")).toHaveAttribute("tabindex", "-1");
      await persona.click(opcionEstado("Todos"));
      expect(parametros()).toEqual({ pagina: "2" });

      await persona.keyboard("{ArrowRight}");
      expect(opcionEstado("Abiertos")).toBeChecked();
      expect(opcionEstado("Abiertos")).toHaveFocus();
      expect(parametros()).toEqual({ estado: "ABIERTO" });
      await waitFor(() => expect(ultimoPedido()).toEqual([{ estado: "ABIERTO" }, 1, 25]));

      await persona.keyboard("{ArrowDown}");
      expect(opcionEstado("En progreso")).toBeChecked();
      expect(parametros()).toEqual({ estado: "EN_PROGRESO" });

      await persona.keyboard("{End}");
      expect(opcionEstado("Cerrados")).toBeChecked();
      expect(parametros()).toEqual({ estado: "CERRADO" });

      await persona.keyboard("{ArrowRight}");
      expect(opcionEstado("Todos")).toBeChecked();
      expect(parametros()).toEqual({});
      await waitFor(() => expect(ultimoPedido()).toEqual([{}, 1, 25]));

      await persona.keyboard("{ArrowLeft}");
      expect(opcionEstado("Cerrados")).toBeChecked();
      expect(opcionEstado("Cerrados")).toHaveFocus();
    });
  });

  describe("RF-7: filtros", () => {
    it("ofrece prioridad y categoría; con dos activos el botón dice 'Filtros · 2'", async () => {
      const { persona } = await montar({ ruta: "/bandeja?pagina=2", bandeja: (_filtros, n) => paginaDeMuchos(n, 60) });
      await esperarPie("26–50 de 60");
      await persona.click(botonFiltros());
      expect(botonFiltros()).toHaveAttribute("aria-expanded", "true");
      const opciones = (nombre: string) => within(selector(nombre)).getAllByRole("option").map((opcion) => opcion.textContent);
      expect(opciones("Prioridad")).toEqual(["Todas", "Baja", "Media", "Alta", "Crítica"]);
      expect(opciones("Categoría")).toEqual(["Todas", "Hardware", "Software", "Red", "Accesos", "Otro"]);
      expect(selector("Prioridad")).toHaveDisplayValue("Todas");

      await persona.selectOptions(selector("Prioridad"), "Alta");
      expect(botonFiltros()).toHaveAccessibleName("Filtros · 1");
      expect(parametros()).toEqual({ prioridad: "ALTA" });
      await waitFor(() => expect(ultimoPedido()).toEqual([{ prioridad: "ALTA" }, 1, 25]));

      await persona.selectOptions(selector("Categoría"), "Red");
      expect(botonFiltros()).toHaveAccessibleName("Filtros · 2");
      expect(parametros()).toEqual({ prioridad: "ALTA", categoria: "Red" });
      await waitFor(() => expect(ultimoPedido()).toEqual([{ prioridad: "ALTA", categoria: "Red" }, 1, 25]));

      await persona.selectOptions(selector("Prioridad"), "Todas");
      expect(botonFiltros()).toHaveAccessibleName("Filtros · 1");
      expect(parametros()).toEqual({ categoria: "Red" });
    });

    it("el estado y la búsqueda no cuentan como filtros del botón", async () => {
      await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn", bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(botonFiltros()).toHaveAccessibleName("Filtros");
    });

    it.each<[Rol, boolean]>([
      ["admin", true],
      ["operador", true],
      ["usuario", false],
      ["consulta", false],
    ])("con el rol %s, 'Solo los asignados a mí' aparece: %s", async (rol, aparece) => {
      const { persona } = await montar({ me: cuenta(rol), bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      await persona.click(botonFiltros());
      if (aparece) expect(casillaMios()).not.toBeChecked();
      else expect(casillaMios()).not.toBeInTheDocument();
    });

    it("'Solo los asignados a mí' pide los del usuario como responsable", async () => {
      const { persona } = await montar({ bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      await persona.click(botonFiltros());
      const casilla = casillaMios();
      if (!casilla) throw new Error("Falta la casilla");
      await persona.click(casilla);
      expect(casilla).toBeChecked();
      expect(parametros()).toEqual({ mios: "1" });
      expect(botonFiltros()).toHaveAccessibleName("Filtros · 1");
      await waitFor(() => expect(ultimoPedido()).toEqual([{ responsable: "u.operador" }, 1, 25]));
    });

    it("sin 'ticket:asignar', un mios=1 en la dirección no filtra ni cuenta", async () => {
      await montar({ ruta: "/bandeja?mios=1", me: cuenta("usuario"), bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(ultimoPedido()).toEqual([{}, 1, 25]);
      expect(botonFiltros()).toHaveAccessibleName("Filtros");
    });
  });

  describe("RF-8: la vista vive en la dirección", () => {
    const sesenta = (_filtros: Filtros, n: number) => paginaDeMuchos(n, 60);

    it("al recargar con ?estado=ABIERTO&q=vpn&pagina=2 muestra esa misma vista", async () => {
      await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn&pagina=2", bandeja: sesenta });
      await esperarPie("26–50 de 60");
      expect(pedidosBandeja()).toEqual([[{ estado: "ABIERTO", q: "vpn" }, 2, 25]]);
      expect(buscador()).toHaveValue("vpn");
      expect(opcionEstado("Abiertos")).toBeChecked();
      expect(vidrio().getByRole("button", { name: "Anterior" })).toBeEnabled();
    });

    it("cambiar el estado vuelve a la página 1 y conserva la búsqueda", async () => {
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn&pagina=2", bandeja: sesenta });
      await esperarPie("26–50 de 60");
      await persona.click(opcionEstado("En progreso"));
      expect(parametros()).toEqual({ estado: "EN_PROGRESO", q: "vpn" });
      await esperarPie("1–25 de 60");
      expect(ultimoPedido()).toEqual([{ estado: "EN_PROGRESO", q: "vpn" }, 1, 25]);
    });

    it("ir al detalle y volver con '‹ Tickets' conserva la vista", async () => {
      vi.spyOn(tickets, "obtener").mockResolvedValue(ticketCompleto(35));
      const { persona } = await montar({ ruta: "/bandeja?estado=ABIERTO&q=vpn&pagina=2", bandeja: sesenta });
      await esperarPie("26–50 de 60");
      await persona.click(fila(35));
      expect(window.location.pathname).toBe("/tickets/35");
      await vidrio().findByRole("heading", { level: 1, name: "La impresora del tercer piso no imprime" });
      await persona.click(vidrio().getByRole("link", { name: "Tickets" }));
      await waitFor(() => expect(window.location.pathname).toBe("/bandeja"));
      expect(parametros()).toEqual({ estado: "ABIERTO", q: "vpn", pagina: "2" });
      await esperarPie("26–50 de 60");
      expect(buscador()).toHaveValue("vpn");
      expect(opcionEstado("Abiertos")).toBeChecked();
      expect(ultimoPedido()).toEqual([{ estado: "ABIERTO", q: "vpn" }, 2, 25]);
    });
  });

  describe("RF-9: el pie de página", () => {
    const cientoTreintaYDos = (_filtros: Filtros, n: number) => paginaDeMuchos(n, 132);

    it("'1–25 de 132' con 'Anterior' deshabilitado en la primera y 'Siguiente' en la última", async () => {
      const { persona } = await montar({ bandeja: cientoTreintaYDos });
      await esperarPie("1–25 de 132");
      const anterior = () => vidrio().getByRole("button", { name: "Anterior" });
      const siguiente = () => vidrio().getByRole("button", { name: "Siguiente" });
      expect(filas()).toHaveLength(25);
      expect(anterior()).toBeDisabled();
      expect(siguiente()).toBeEnabled();

      await persona.click(siguiente());
      expect(parametros()).toEqual({ pagina: "2" });
      await esperarPie("26–50 de 132");
      expect(ultimoPedido()).toEqual([{}, 2, 25]);
      expect(anterior()).toBeEnabled();
      expect(siguiente()).toBeEnabled();

      await persona.click(anterior());
      expect(parametros()).toEqual({});
      await esperarPie("1–25 de 132");
    });

    it("en la última página, 'Siguiente' queda deshabilitado", async () => {
      await montar({ ruta: "/bandeja?pagina=6", bandeja: cientoTreintaYDos });
      await esperarPie("126–132 de 132");
      expect(filas()).toHaveLength(7);
      expect(vidrio().getByRole("button", { name: "Siguiente" })).toBeDisabled();
      expect(vidrio().getByRole("button", { name: "Anterior" })).toBeEnabled();
    });

    it("con 25 o menos no muestra los botones", async () => {
      await montar({ bandeja: (_filtros, n) => paginaDeMuchos(n, 25) });
      await esperarPie("1–25 de 25");
      expect(vidrio().queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
      expect(vidrio().queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    });

    it("una página fuera de rango (?pagina=99) lleva a la última", async () => {
      await montar({ ruta: "/bandeja?pagina=99", bandeja: cientoTreintaYDos });
      await esperarPie("126–132 de 132");
      expect(parametros()).toEqual({ pagina: "6" });
      expect(pedidosBandeja().map(([, n]) => n)).toEqual([99, 6]);
    });
  });

  describe("RF-10: lista vacía", () => {
    it("sin tickets ni filtros: 'No hay tickets', sin 'Limpiar filtros'", async () => {
      await montar();
      expect(await vidrio().findByRole("heading", { level: 2, name: "No hay tickets" })).toBeInTheDocument();
      expect(vidrio().queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
      expect(vidrio().queryByText(/ de \d+$/)).not.toBeInTheDocument();
    });

    it.each(["/bandeja?q=vpn&prioridad=CRITICA", "/bandeja?estado=CERRADO", "/bandeja?categoria=Red"])(
      "en %s: 'Ningún ticket coincide con los filtros' y 'Limpiar filtros' vuelve a la vista inicial",
      async (ruta) => {
        const { persona } = await montar({ ruta });
        expect(await vidrio().findByRole("heading", { level: 2, name: "Ningún ticket coincide con los filtros" })).toBeInTheDocument();
        await persona.click(vidrio().getByRole("button", { name: "Limpiar filtros" }));
        expect(parametros()).toEqual({});
        await waitFor(() => expect(ultimoPedido()).toEqual([{}, 1, 25]));
        expect(await vidrio().findByRole("heading", { level: 2, name: "No hay tickets" })).toBeInTheDocument();
        expect(buscador()).toHaveValue("");
        expect(opcionEstado("Todos")).toBeChecked();
        expect(botonFiltros()).toHaveAccessibleName("Filtros");
      },
    );
  });

  describe("RF-11: falla al cargar", () => {
    it("'No se pudo cargar la bandeja.' con 'Reintentar', que vuelve a pedir", async () => {
      let intentos = 0;
      const { persona } = await montar({
        bandeja: () => {
          intentos += 1;
          if (intentos === 1) throw sinConexion();
          return pagina([ticket(45)]);
        },
      });
      const alerta = await vidrio().findByRole("alert");
      expect(within(alerta).getByRole("heading", { level: 2, name: "No se pudo cargar la bandeja." })).toBeInTheDocument();
      expect(filas()).toHaveLength(0);
      await persona.click(within(alerta).getByRole("button", { name: "Reintentar" }));
      await esperarFilas(1);
      expect(vidrio().queryByRole("alert")).not.toBeInTheDocument();
      expect(pedidosBandeja()).toHaveLength(2);
    });
  });

  describe("RF-12: recarga", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("pide al entrar y al volver a la pestaña, sin cambiar la vista", async () => {
      await montar({ ruta: "/bandeja?estado=ABIERTO", bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      expect(pedidosBandeja()).toEqual([[{ estado: "ABIERTO" }, 1, 25]]);
      await cambiarVisibilidad("hidden");
      expect(pedidosBandeja()).toHaveLength(1);
      await cambiarVisibilidad("visible");
      expect(pedidosBandeja()).toEqual([
        [{ estado: "ABIERTO" }, 1, 25],
        [{ estado: "ABIERTO" }, 1, 25],
      ]);
      expect(parametros()).toEqual({ estado: "ABIERTO" });
      expect(filas()).toHaveLength(1);
    });

    it("vuelve a pedir cada 5 minutos", async () => {
      const reloj = relojFalso();
      await montar({ bandeja: pagina([ticket(45)]), reloj });
      await esperarFilas(1);
      expect(pedidosBandeja()).toHaveLength(1);
      await avanzar(4 * MINUTO + 50_000, reloj);
      expect(pedidosBandeja()).toHaveLength(1);
      await avanzar(10_000, reloj);
      expect(pedidosBandeja()).toHaveLength(2);
      expect(ultimoPedido()).toEqual([{}, 1, 25]);
      expect(filas()).toHaveLength(1);
    });

    it("no pide mientras el fin de jornada está activo", async () => {
      const reloj = relojFalso();
      await montar({ bandeja: pagina([ticket(45)]), reloj });
      await esperarFilas(1);
      await act(async () => {
        window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA, { detail: FUERA_DE_HORARIO }));
      });
      expect(screen.getByRole("alertdialog", { name: "La jornada terminó" })).toBeInTheDocument();
      const antes = pedidosBandeja().length;
      await cambiarVisibilidad("visible");
      await avanzar(5 * MINUTO + 10_000, reloj);
      expect(pedidosBandeja()).toHaveLength(antes);
    });
  });

  describe("RF-13: 'Nuevo ticket' solo con 'ticket:crear'", () => {
    it.each<[Rol, boolean]>([
      ["admin", true],
      ["operador", true],
      ["usuario", true],
      ["consulta", false],
    ])("con el rol %s, el botón aparece: %s", async (rol, aparece) => {
      await montar({ me: cuenta(rol), bandeja: pagina([ticket(45)]) });
      await esperarFilas(1);
      if (aparece) expect(botonNuevo()).toHaveAttribute("href", "/tickets/nuevo");
      else expect(botonNuevo()).not.toBeInTheDocument();
    });

    it("/tickets/nuevo sin el permiso muestra 'No tenés acceso a esta sección' y no abre el diálogo", async () => {
      await montar({ ruta: "/tickets/nuevo", me: cuenta("consulta") });
      expect(await vidrio().findByRole("heading", { level: 1, name: "No tenés acceso a esta sección" })).toBeInTheDocument();
      expect(vidrio().getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("href", "/bandeja");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
