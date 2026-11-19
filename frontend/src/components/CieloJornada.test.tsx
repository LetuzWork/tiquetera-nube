import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiError, EVENTO_SESION_CAIDA } from "../api/client";
import { auth, tickets } from "../api/endpoints";
import type { Horario, Me, Pagina } from "../api/types";
import { ProveedorAuth } from "../auth/AuthContext";
import { cieloDe } from "../jornada/cielo";
import { calcularJornada } from "../jornada/jornada";
import { ProveedorJornada } from "../jornada/JornadaContext";
import { horarioDe, meDe, paginaDe, ticketResumenDe } from "../test/fabricas";
import { objetivosObservados, simularInterseccion } from "../test/interseccion";
import { cambiarVisibilidad, relojFalso } from "../test/tiempo";
import { instanteDe } from "../utils/zona";
import { CieloJornada } from "./CieloJornada";

const MARTES_0800 = "2026-11-17T11:00:00Z";
const MARTES_1420 = "2026-11-17T17:20:00Z";
const MARTES_1748 = "2026-11-17T20:48:00Z";
const MARTES_1820 = "2026-11-17T21:20:00Z";
const MARTES_1930 = "2026-11-17T22:30:00Z";

const HORA = /^\d{2}:\d{2}$/;

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

const DE_HOY = paginaDe(
  [
    ticketResumenDe({ numero: 49, creado_en: "2026-11-17T15:05:00Z" }),
    ticketResumenDe({ numero: 45, estado: "EN_PROGRESO", creado_en: "2026-11-17T13:05:00Z" }),
    ticketResumenDe({ numero: 41, estado: "RESUELTO", creado_en: "2026-11-17T11:30:00Z" }),
  ],
  { total: 7, por_pagina: 100 },
);

interface Opciones {
  ahora?: string;
  franja?: "llega" | "falla" | "pendiente";
  me?: Me;
  deHoy?: Pagina | "falla";
}

async function montar({ ahora = MARTES_1420, franja = "llega", me = meDe("operador"), deHoy = DE_HOY }: Opciones = {}) {
  const reloj = relojFalso();
  vi.spyOn(auth, "me").mockResolvedValue(me);
  const horario = vi.spyOn(auth, "horario");
  if (franja === "llega") horario.mockResolvedValue(horarioDe(ahora));
  else if (franja === "falla") horario.mockRejectedValue(sinConexion());
  else horario.mockReturnValue(new Promise<Horario>(() => undefined));
  const listar = vi.spyOn(tickets, "listar");
  if (deHoy === "falla") listar.mockRejectedValue(sinConexion());
  else listar.mockResolvedValue(deHoy);
  await act(async () => {
    render(
      <ProveedorAuth relojMonotono={reloj.ahora}>
        <ProveedorJornada relojMonotono={reloj.ahora}>
          <MemoryRouter initialEntries={["/bandeja"]}>
            <CieloJornada />
          </MemoryRouter>
        </ProveedorJornada>
      </ProveedorAuth>,
    );
  });
  return { listar };
}

const cielo = () => screen.getByRole("banner");
const variable = (elemento: HTMLElement, nombre: string) => elemento.style.getPropertyValue(nombre);
const barra = () => document.querySelector<HTMLElement>('[data-barra="compacta"]');

function barraVisible(): HTMLElement {
  const elemento = barra();
  if (!elemento) throw new Error("No está la barra compacta");
  return elemento;
}

describe("CieloJornada", () => {
  describe("RF-16 y RF-18: el encabezado", () => {
    it("muestra el logo, la navegación, la cuenta, el reloj, el estado y la franja", async () => {
      await montar();
      const encabezado = cielo();
      expect(within(encabezado).getByText("Tiquetera Nube")).toBeInTheDocument();
      expect(within(encabezado).getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
      expect(within(encabezado).getByRole("button", { name: "Cuenta de Omar Operador" })).toBeInTheDocument();
      expect(within(encabezado).getByText("14:20")).toBeInTheDocument();
      expect(within(encabezado).getByText("Quedan 3 h 40 min de jornada")).toHaveAttribute("data-jornada", "abierta");
      expect(within(encabezado).getByText("Lunes a viernes, de 08:00 a 18:00")).toBeInTheDocument();
      expect(within(encabezado).queryByText("Cierra 18:00 · quedan 3 h 40 min")).not.toBeInTheDocument();
    });

    it("en por cerrar, el estado es la píldora 'Cierra en 12 min'", async () => {
      await montar({ ahora: MARTES_1748 });
      expect(within(cielo()).getByText("17:48")).toBeInTheDocument();
      expect(within(cielo()).getByText("Cierra en 12 min")).toHaveAttribute("data-jornada", "por-cerrar");
    });

    it("cerrada, dice 'Fuera del horario de atención' y sigue el horizonte", async () => {
      await montar({ ahora: MARTES_1930 });
      expect(within(cielo()).getByText("19:30")).toBeInTheDocument();
      expect(within(cielo()).getByText("Fuera del horario de atención")).toHaveAttribute("data-jornada", "cerrada");
      expect(await within(cielo()).findByRole("group", { name: /^Jornada de 08:00 a 18:00\. Son las 19:30\./ })).toBeInTheDocument();
    });
  });

  describe("RF-8: el cielo y su tinta", () => {
    it("a las 08:00 usa el cielo de la tabla y la tinta #14233c", async () => {
      await montar({ ahora: MARTES_0800 });
      const encabezado = cielo();
      expect(variable(encabezado, "--tq-cielo-arriba")).toBe("#6788d6");
      expect(variable(encabezado, "--tq-cielo-abajo")).toBe("#c6a39d");
      expect(variable(encabezado, "--tq-cielo-tinta")).toBe("#14233c");
      expect(encabezado).toHaveAttribute("data-tinta", "#14233c");
    });

    it("a las 18:20 usa el cielo de la tabla y la tinta #ffffff", async () => {
      await montar({ ahora: MARTES_1820 });
      const encabezado = cielo();
      expect(variable(encabezado, "--tq-cielo-arriba")).toBe("#2a2d5a");
      expect(variable(encabezado, "--tq-cielo-abajo")).toBe("#795162");
      expect(variable(encabezado, "--tq-cielo-tinta")).toBe("#ffffff");
      expect(encabezado).toHaveAttribute("data-tinta", "#ffffff");
    });

    it("la tinta y los colores son los de cieloDe", async () => {
      await montar();
      const horario = horarioDe(MARTES_1420);
      const esperado = cieloDe(horario, calcularJornada(horario, instanteDe(MARTES_1420)), false);
      expect(esperado).not.toBeNull();
      expect(variable(cielo(), "--tq-cielo-arriba")).toBe(esperado?.arriba);
      expect(variable(cielo(), "--tq-cielo-abajo")).toBe(esperado?.abajo);
      expect(cielo()).toHaveAttribute("data-tinta", esperado?.tinta);
    });
  });

  describe("RF-12 y RF-13: el horizonte y la cuenta de tickets", () => {
    it("pide los tickets de hoy y pone una marca por cada uno", async () => {
      const { listar } = await montar();
      const grupo = await screen.findByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 14:20. Hoy entraron 7 tickets." });
      expect(listar).toHaveBeenCalledWith({ desde: "2026-11-17", hasta: "2026-11-17" }, 1, 100);
      expect(within(grupo).getAllByRole("button").map((marca) => marca.getAttribute("aria-label"))).toEqual([
        "TQ-000041 · 08:30 · Resuelto",
        "TQ-000045 · 10:05 · En progreso",
        "TQ-000049 · 12:05 · Abierto",
      ]);
    });

    it("muestra la cuenta total debajo del horizonte", async () => {
      await montar();
      expect(await within(cielo()).findByText("Hoy entraron 7 tickets.")).toBeInTheDocument();
    });

    it("para el rol Usuario, la cuenta dice que son suyos", async () => {
      await montar({ me: meDe("usuario"), deHoy: paginaDe([ticketResumenDe({ numero: 45 }), ticketResumenDe({ numero: 46 })]) });
      expect(await within(cielo()).findByText("Hoy entraron 2 tickets tuyos.")).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 14:20. Hoy entraron 2 tickets tuyos." })).toBeInTheDocument();
    });

    it("para el rol Usuario sin tickets, 'Hoy no entró ningún ticket tuyo.'", async () => {
      await montar({ me: meDe("usuario"), deHoy: paginaDe([]) });
      expect(await within(cielo()).findByText("Hoy no entró ningún ticket tuyo.")).toBeInTheDocument();
    });

    it("si falla la consulta, no hay marcas y lo dice", async () => {
      await montar({ deHoy: "falla" });
      expect(await within(cielo()).findByText("No se pudieron cargar los tickets de hoy.")).toBeInTheDocument();
      const grupo = screen.getByRole("group", {
        name: "Jornada de 08:00 a 18:00. Son las 14:20. No se pudieron cargar los tickets de hoy.",
      });
      expect(within(grupo).queryByRole("button")).not.toBeInTheDocument();
    });

    it("con el diálogo de fin abierto deja de pedir los tickets", async () => {
      const { listar } = await montar();
      await screen.findByText("Hoy entraron 7 tickets.");
      expect(listar).toHaveBeenCalledTimes(1);
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(EVENTO_SESION_CAIDA, {
            detail: { codigo: "SESION_FUERA_DE_HORARIO", detalle: "La franja horaria cerró y la sesión caducó." },
          }),
        );
      });
      await cambiarVisibilidad("visible");
      expect(listar).toHaveBeenCalledTimes(1);
    });
  });

  describe("RF-9: sin franja todavía o sin franja tras una falla", () => {
    it("mientras la franja no llegó, el fondo es liso, sin reloj ni horizonte", async () => {
      const { listar } = await montar({ franja: "pendiente" });
      const encabezado = cielo();
      expect(encabezado).not.toHaveAttribute("data-tinta");
      expect(variable(encabezado, "--tq-cielo-arriba")).toBe("");
      expect(within(encabezado).getByText("Tiquetera Nube")).toBeInTheDocument();
      expect(within(encabezado).queryByText(HORA)).not.toBeInTheDocument();
      expect(within(encabezado).queryByRole("group")).not.toBeInTheDocument();
      expect(within(encabezado).queryByText("No se pudo consultar el horario.")).not.toBeInTheDocument();
      expect(listar).not.toHaveBeenCalled();
    });

    it("si la franja falló, usa el cielo de las 13:00, sin reloj ni horizonte, y lo dice", async () => {
      const { listar } = await montar({ franja: "falla" });
      const encabezado = cielo();
      expect(variable(encabezado, "--tq-cielo-arriba")).toBe("#4f98f0");
      expect(variable(encabezado, "--tq-cielo-abajo")).toBe("#e3f0ff");
      expect(encabezado).toHaveAttribute("data-tinta", "#14233c");
      expect(within(encabezado).getByText("No se pudo consultar el horario.")).toBeInTheDocument();
      expect(within(encabezado).queryByText(HORA)).not.toBeInTheDocument();
      expect(within(encabezado).queryByRole("group")).not.toBeInTheDocument();
      expect(listar).not.toHaveBeenCalled();
    });
  });

  describe("RF-20: la barra compacta", () => {
    it("observa el encabezado con umbral 0", async () => {
      await montar();
      expect(objetivosObservados()).toEqual([{ objetivo: cielo(), umbrales: [0] }]);
    });

    it("mientras el cielo se ve, no hay barra", async () => {
      await montar();
      expect(objetivosObservados()).toHaveLength(1);
      simularInterseccion(true);
      expect(barra()).toBeNull();
      expect(screen.queryByRole("navigation", { name: "Secciones, barra fija" })).not.toBeInTheDocument();
    });

    it("abierta: aparece cuando el cielo sale del todo y se va cuando vuelve", async () => {
      await montar();
      simularInterseccion(false);
      const fija = barraVisible();
      expect(cielo()).not.toContainElement(fija);
      expect(within(fija).getByText("Tiquetera Nube")).toBeInTheDocument();
      expect(within(fija).getByRole("navigation", { name: "Secciones, barra fija" })).toBeInTheDocument();
      expect(within(fija).getByRole("button", { name: "Cuenta de Omar Operador" })).toBeInTheDocument();
      expect(within(fija).getByText("Cierra 18:00 · quedan 3 h 40 min")).toBeInTheDocument();
      expect(fija).toHaveAttribute("data-tinta", cielo().getAttribute("data-tinta"));
      expect(variable(fija, "--tq-cielo-arriba")).toBe(variable(cielo(), "--tq-cielo-arriba"));
      expect(variable(fija, "--tq-cielo-abajo")).toBe(variable(cielo(), "--tq-cielo-abajo"));
      simularInterseccion(true);
      expect(barra()).toBeNull();
    });

    it("por cerrar: 'Cierra en 12 min'", async () => {
      await montar({ ahora: MARTES_1748 });
      simularInterseccion(false);
      expect(within(barraVisible()).getByText("Cierra en 12 min")).toBeInTheDocument();
    });

    it("cerrada: 'Fuera del horario de atención'", async () => {
      await montar({ ahora: MARTES_1930 });
      simularInterseccion(false);
      expect(within(barraVisible()).getByText("Fuera del horario de atención")).toBeInTheDocument();
    });

    it("sin franja: la barra no muestra estado", async () => {
      await montar({ franja: "falla" });
      simularInterseccion(false);
      const fija = barraVisible();
      expect(within(fija).getByRole("navigation", { name: "Secciones, barra fija" })).toBeInTheDocument();
      expect(fija).toHaveAttribute("data-tinta", "#14233c");
      expect(variable(fija, "--tq-cielo-arriba")).toBe("#4f98f0");
      expect(within(fija).queryByText(/Cierra|quedan|Fuera del horario|No se pudo/)).not.toBeInTheDocument();
    });
  });
});
