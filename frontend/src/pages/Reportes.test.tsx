import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth, reportes } from "../api/endpoints";
import type { Horario, Me, Permiso, Resumen, Rol } from "../api/types";
import { horarioDe, meDe } from "../test/fabricas";
import { renderizarApp } from "../test/render";

// Hoy es martes 17 de noviembre en el servidor (14:20 en Buenos Aires).
const MARTES_1420 = "2026-11-17T17:20:00Z";
// 14:00 del miércoles 2 de diciembre en Buenos Aires; en Tokio, la zona de las pruebas, ya es el 3.
const MIERCOLES_2_DIC = "2026-12-02T17:00:00Z";

const DESCRIPTOR_LOCATION = Object.getOwnPropertyDescriptor(globalThis, "location");

function resumenDe(cambios: Partial<Resumen> = {}): Resumen {
  return {
    total: 40,
    pendientes: 12,
    criticos_activos: 3,
    horas_promedio_resolucion: 5.24,
    por_estado: { ABIERTO: 8, EN_PROGRESO: 4, RESUELTO: 20, CERRADO: 8 },
    por_prioridad: { BAJA: 10, MEDIA: 18, ALTA: 9, CRITICA: 3 },
    por_categoria: { Hardware: 15, Software: 10, Red: 8, Accesos: 5, Otro: 2 },
    por_responsable: { "u.operador": 25, "u.admin": 10, "sin asignar": 5 },
    por_dia: { "2026-11-16": 3, "2026-11-17": 2 },
    ...cambios,
  };
}

const RESUMEN_VACIO: Resumen = {
  total: 0,
  pendientes: 0,
  criticos_activos: 0,
  horas_promedio_resolucion: null,
  por_estado: { ABIERTO: 0, EN_PROGRESO: 0, RESUELTO: 0, CERRADO: 0 },
  por_prioridad: { BAJA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 },
  por_categoria: { Hardware: 0, Software: 0, Red: 0, Accesos: 0, Otro: 0 },
  por_responsable: {},
  por_dia: {},
};

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

function pendiente<T>() {
  let resolver: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promesa, resolver };
}

interface Opciones {
  rol?: Rol;
  me?: Me;
  ahora?: string;
  resumen?: Resumen | Error;
  franja?: "pendiente" | "falla";
}

async function montar({ rol = "admin", me = meDe(rol), ahora = MARTES_1420, resumen = resumenDe(), franja }: Opciones = {}) {
  const espia = vi.spyOn(reportes, "resumen");
  if (resumen instanceof Error) espia.mockRejectedValue(resumen);
  else espia.mockResolvedValue(resumen);
  if (franja === "pendiente") vi.spyOn(auth, "horario").mockReturnValue(new Promise<Horario>(() => undefined));
  const app = await renderizarApp({ ruta: "/reportes", me, horario: franja === "falla" ? null : horarioDe(ahora) });
  return { ...app, persona: userEvent.setup() };
}

async function montarCargado(opciones: Opciones = {}) {
  const montado = await montar(opciones);
  await screen.findByText("Pendientes");
  return montado;
}

function espiarDescargas() {
  const real = window.location;
  const assign = vi.fn<(url: string) => void>();
  // El destino del Proxy es un objeto vacío: las propiedades de Location no son configurables y no se pueden reemplazar.
  vi.stubGlobal(
    "location",
    new Proxy(
      {},
      {
        get(_destino, clave) {
          if (clave === "assign") return assign;
          const valor: unknown = Reflect.get(real, clave);
          return typeof valor === "function" ? valor.bind(real) : valor;
        },
      },
    ),
  );
  return assign;
}

const vidrio = () => screen.getByRole("main");
const periodo = () => screen.getByRole("radiogroup", { name: "Período" });
const opcionPeriodo = (nombre: string) => within(periodo()).getByRole("radio", { name: nombre });

function tarjeta(nombre: string): Element {
  const valor = screen.getByText(nombre, { selector: "dt" }).nextElementSibling;
  if (!valor) throw new Error(`La tarjeta ${nombre} no tiene valor`);
  return valor;
}

function filas(titulo: string): string[][] {
  const tabla = within(screen.getByRole("region", { name: titulo })).getByRole("table");
  return within(tabla)
    .getAllByRole("row")
    .slice(1)
    .map((fila) => [
      within(fila).getByRole("rowheader").textContent ?? "",
      within(fila).getByRole("cell").textContent ?? "",
    ]);
}

describe("Reportes", () => {
  afterEach(() => {
    if (DESCRIPTOR_LOCATION) Object.defineProperty(globalThis, "location", DESCRIPTOR_LOCATION);
  });

  describe("RF-28: período", () => {
    it("arranca en '30 días' y pide desde hoy menos 29 días hasta hoy", async () => {
      await montarCargado();
      expect(within(vidrio()).getByRole("heading", { level: 1, name: "Reportes" })).toBeInTheDocument();
      expect(within(periodo()).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
        "7 días",
        "30 días",
        "90 días",
        "Todo",
      ]);
      expect(opcionPeriodo("30 días")).toHaveAttribute("aria-checked", "true");
      expect(reportes.resumen).toHaveBeenCalledTimes(1);
      expect(reportes.resumen).toHaveBeenCalledWith({ desde: "2026-10-19", hasta: "2026-11-17" });
    });

    it.each([
      ["7 días", { desde: "2026-11-11", hasta: "2026-11-17" }],
      ["90 días", { desde: "2026-08-20", hasta: "2026-11-17" }],
      ["Todo", {}],
    ])("'%s' pide %j", async (nombre, rango) => {
      const { persona } = await montarCargado();
      await persona.click(opcionPeriodo(nombre));
      expect(opcionPeriodo(nombre)).toHaveAttribute("aria-checked", "true");
      await waitFor(() => expect(reportes.resumen).toHaveBeenCalledTimes(2));
      expect(reportes.resumen).toHaveBeenLastCalledWith(rango);
    });

    it("con flechas se cambia el período y se vuelve a pedir", async () => {
      const { persona } = await montarCargado();
      opcionPeriodo("30 días").focus();
      await persona.keyboard("{ArrowLeft}");
      expect(opcionPeriodo("7 días")).toHaveAttribute("aria-checked", "true");
      expect(opcionPeriodo("7 días")).toHaveFocus();
      await waitFor(() => expect(reportes.resumen).toHaveBeenLastCalledWith({ desde: "2026-11-11", hasta: "2026-11-17" }));
    });

    it.each([
      ["30 días", { desde: "2026-11-03", hasta: "2026-12-02" }],
      ["7 días", { desde: "2026-11-26", hasta: "2026-12-02" }],
    ])("cruzando un cambio de mes, '%s' pide %j con el día del servidor", async (nombre, rango) => {
      const me = meDe("admin", { sesion_expira: "2026-12-02T18:00:00-03:00", segundos_restantes: 14400 });
      const { persona } = await montarCargado({ ahora: MIERCOLES_2_DIC, me });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      if (nombre !== "30 días") await persona.click(opcionPeriodo(nombre));
      await waitFor(() => expect(reportes.resumen).toHaveBeenLastCalledWith(rango));
    });

    it("mientras no hay jornada no pide nada", async () => {
      await montar({ franja: "pendiente" });
      expect(within(vidrio()).getByRole("status")).toHaveTextContent("Cargando…");
      expect(reportes.resumen).not.toHaveBeenCalled();
    });

    it("una respuesta vieja no pisa la del período elegido después", async () => {
      const viejo = pendiente<Resumen>();
      const { persona } = await montar();
      await waitFor(() => expect(reportes.resumen).toHaveBeenCalledTimes(1));
      vi.mocked(reportes.resumen).mockReset();
      vi.mocked(reportes.resumen).mockReturnValueOnce(viejo.promesa).mockResolvedValueOnce(resumenDe({ total: 7 }));
      await persona.click(opcionPeriodo("90 días"));
      await persona.click(opcionPeriodo("7 días"));
      await waitFor(() => expect(tarjeta("Total")).toHaveTextContent("7"));
      await act(async () => {
        viejo.resolver(resumenDe({ total: 90 }));
      });
      expect(tarjeta("Total")).toHaveTextContent("7");
    });
  });

  describe("RF-29: tarjetas", () => {
    it("muestra Pendientes, Críticos activos, Total y el tiempo medio con un decimal", async () => {
      await montarCargado();
      expect(tarjeta("Pendientes")).toHaveTextContent("12");
      expect(tarjeta("Críticos activos")).toHaveTextContent("3");
      expect(tarjeta("Total")).toHaveTextContent("40");
      expect(tarjeta("Tiempo medio de resolución")).toHaveTextContent("5.2 h");
      expect(tarjeta("Tiempo medio de resolución")).not.toHaveAttribute("data-sin-datos");
    });

    it("sin resueltos, el tiempo medio dice 'Sin datos'", async () => {
      await montarCargado({ resumen: resumenDe({ horas_promedio_resolucion: null }) });
      expect(tarjeta("Tiempo medio de resolución")).toHaveTextContent("Sin datos");
      expect(tarjeta("Tiempo medio de resolución")).toHaveAttribute("data-sin-datos", "true");
    });
  });

  describe("RF-30: gráficos con su tabla", () => {
    it("cada gráfico tiene su tabla, en el orden de la app y con los nombres en español", async () => {
      await montarCargado();
      expect(filas("Por estado")).toEqual([
        ["Abierto", "8"],
        ["En progreso", "4"],
        ["Resuelto", "20"],
        ["Cerrado", "8"],
      ]);
      expect(filas("Por prioridad")).toEqual([
        ["Baja", "10"],
        ["Media", "18"],
        ["Alta", "9"],
        ["Crítica", "3"],
      ]);
      expect(filas("Por categoría")).toEqual([
        ["Hardware", "15"],
        ["Software", "10"],
        ["Red", "8"],
        ["Accesos", "5"],
        ["Otro", "2"],
      ]);
      expect(filas("Por responsable")).toEqual([
        ["u.operador", "25"],
        ["u.admin", "10"],
        ["Sin asignar", "5"],
      ]);
    });

    it("'Por día' completa con cero los días sin tickets y los nombra con la fecha corta", async () => {
      const { persona } = await montarCargado();
      const treinta = filas("Por día");
      expect(treinta).toHaveLength(30);
      expect(treinta[0]).toEqual(["19 oct", "0"]);
      expect(treinta.slice(-2)).toEqual([
        ["16 nov", "3"],
        ["17 nov", "2"],
      ]);
      await persona.click(opcionPeriodo("7 días"));
      await waitFor(() => expect(filas("Por día")).toHaveLength(7));
      expect(filas("Por día")).toEqual([
        ["11 nov", "0"],
        ["12 nov", "0"],
        ["13 nov", "0"],
        ["14 nov", "0"],
        ["15 nov", "0"],
        ["16 nov", "3"],
        ["17 nov", "2"],
      ]);
    });

    it("con 'Todo', 'Por día' va del primer al último día con tickets", async () => {
      const { persona } = await montarCargado();
      vi.mocked(reportes.resumen).mockResolvedValue(resumenDe({ por_dia: { "2026-10-30": 4, "2026-11-02": 1 } }));
      await persona.click(opcionPeriodo("Todo"));
      await waitFor(() => expect(filas("Por día")).toHaveLength(4));
      expect(filas("Por día")).toEqual([
        ["30 oct", "4"],
        ["31 oct", "0"],
        ["1 nov", "0"],
        ["2 nov", "1"],
      ]);
    });

    it("sin tickets en el período lo dice y no dibuja gráficos", async () => {
      await montarCargado({ resumen: RESUMEN_VACIO });
      expect(within(vidrio()).getByText("Sin tickets en el período.")).toBeInTheDocument();
      expect(tarjeta("Total")).toHaveTextContent("0");
      expect(tarjeta("Tiempo medio de resolución")).toHaveTextContent("Sin datos");
      for (const titulo of ["Por estado", "Por prioridad", "Por categoría", "Por responsable", "Por día"]) {
        expect(screen.queryByRole("region", { name: titulo })).not.toBeInTheDocument();
      }
    });
  });

  describe("RF-31: exportar", () => {
    it.each<Rol>(["admin", "operador", "consulta"])("con el rol %s aparece 'Exportar' con sus dos opciones", async (rol) => {
      const { persona } = await montarCargado({ rol });
      await persona.click(within(vidrio()).getByRole("button", { name: "Exportar" }));
      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tickets (CSV)", "Historial (CSV)"]);
    });

    it("sin reporte:exportar no aparece", async () => {
      const permisos: Permiso[] = ["reporte:ver", "ticket:ver_propios", "ticket:ver_todos"];
      await montarCargado({ me: meDe("consulta", { permisos }) });
      expect(within(vidrio()).queryByRole("button", { name: "Exportar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Tickets (CSV)" })).not.toBeInTheDocument();
    });

    it.each([
      ["30 días", "Tickets (CSV)", "/api/reportes/export/tickets.csv?desde=2026-10-19&hasta=2026-11-17"],
      ["30 días", "Historial (CSV)", "/api/reportes/export/historial.csv?desde=2026-10-19&hasta=2026-11-17"],
      ["7 días", "Tickets (CSV)", "/api/reportes/export/tickets.csv?desde=2026-11-11&hasta=2026-11-17"],
      ["90 días", "Historial (CSV)", "/api/reportes/export/historial.csv?desde=2026-08-20&hasta=2026-11-17"],
      ["Todo", "Tickets (CSV)", "/api/reportes/export/tickets.csv"],
    ])("con '%s', '%s' descarga %s", async (nombre, opcion, url) => {
      const { persona } = await montarCargado();
      if (nombre !== "30 días") await persona.click(opcionPeriodo(nombre));
      const descargar = espiarDescargas();
      await persona.click(within(vidrio()).getByRole("button", { name: "Exportar" }));
      await persona.click(screen.getByRole("menuitem", { name: opcion }));
      expect(descargar).toHaveBeenCalledTimes(1);
      expect(descargar).toHaveBeenCalledWith(url);
      expect(window.location.pathname).toBe("/reportes");
    });

    it("con teclado: Enter abre el menú y Enter elige", async () => {
      const { persona } = await montarCargado();
      const descargar = espiarDescargas();
      within(vidrio()).getByRole("button", { name: "Exportar" }).focus();
      await persona.keyboard("{Enter}");
      expect(screen.getByRole("menuitem", { name: "Tickets (CSV)" })).toHaveFocus();
      await persona.keyboard("{ArrowDown}{Enter}");
      expect(descargar).toHaveBeenCalledWith("/api/reportes/export/historial.csv?desde=2026-10-19&hasta=2026-11-17");
    });
  });

  describe("RF-32: si el resumen no se puede cargar", () => {
    it("dice 'No se pudo cargar el resumen.' y 'Reintentar' lo vuelve a pedir", async () => {
      const { persona } = await montar({ resumen: sinConexion() });
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el resumen.");
      expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
      vi.mocked(reportes.resumen).mockResolvedValue(resumenDe());
      await persona.click(within(vidrio()).getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByText("Pendientes")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(reportes.resumen).toHaveBeenCalledTimes(2);
      expect(reportes.resumen).toHaveBeenLastCalledWith({ desde: "2026-10-19", hasta: "2026-11-17" });
    });

    it("si falla al cambiar de período, el error reemplaza al contenido y reintenta ese período", async () => {
      const { persona } = await montarCargado();
      vi.mocked(reportes.resumen).mockRejectedValue(sinConexion());
      await persona.click(opcionPeriodo("7 días"));
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el resumen.");
      expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
      vi.mocked(reportes.resumen).mockResolvedValue(resumenDe());
      await persona.click(within(vidrio()).getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByText("Pendientes")).toBeInTheDocument();
      expect(reportes.resumen).toHaveBeenLastCalledWith({ desde: "2026-11-11", hasta: "2026-11-17" });
    });

    it("sin la franja tampoco hay período: lo dice y 'Reintentar' vuelve a consultar el horario", async () => {
      const { persona } = await montar({ franja: "falla" });
      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el resumen.");
      expect(reportes.resumen).not.toHaveBeenCalled();
      const consultas = vi.mocked(auth.horario).mock.calls.length;
      vi.mocked(auth.horario).mockResolvedValue(horarioDe(MARTES_1420));
      await persona.click(within(vidrio()).getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByText("Pendientes")).toBeInTheDocument();
      expect(vi.mocked(auth.horario).mock.calls.length).toBeGreaterThan(consultas);
      expect(reportes.resumen).toHaveBeenCalledWith({ desde: "2026-10-19", hasta: "2026-11-17" });
    });
  });
});
