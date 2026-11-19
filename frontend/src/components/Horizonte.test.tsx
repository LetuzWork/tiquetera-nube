import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TicketResumen } from "../api/types";
import { marcasDelDia } from "../jornada/horizonte";
import { calcularJornada } from "../jornada/jornada";
import { horarioDe, ticketResumenDe } from "../test/fabricas";
import { SondaRuta } from "../test/render";
import { instanteDe } from "../utils/zona";
import { Horizonte } from "./Horizonte";

const MARTES_1420 = "2026-11-17T17:20:00Z";
const CUENTA = "Hoy entraron 3 tickets.";
const NOMBRE = `Jornada de 08:00 a 18:00. Son las 14:20. ${CUENTA}`;

const RESUELTO_0830 = "TQ-000041 · 08:30 · Resuelto";
const PROGRESO_1005 = "TQ-000045 · 10:05 · En progreso";
const ABIERTO_1205 = "TQ-000049 · 12:05 · Abierto";

const TICKETS: TicketResumen[] = [
  ticketResumenDe({ numero: 49, estado: "ABIERTO", creado_en: "2026-11-17T15:05:00Z" }),
  ticketResumenDe({ numero: 45, estado: "EN_PROGRESO", creado_en: "2026-11-17T13:05:00Z" }),
  ticketResumenDe({ numero: 41, estado: "RESUELTO", creado_en: "2026-11-17T11:30:00Z" }),
];

interface Opciones {
  ahora?: string;
  items?: TicketResumen[];
  cuenta?: string | null;
}

function montar({ ahora = MARTES_1420, items = TICKETS, cuenta = CUENTA }: Opciones = {}) {
  const horario = horarioDe(ahora);
  const jornada = calcularJornada(horario, instanteDe(ahora));
  const resultado = render(
    <MemoryRouter initialEntries={["/bandeja"]}>
      <button type="button">Antes</button>
      <Horizonte horario={horario} jornada={jornada} marcas={marcasDelDia(items, horario)} cuenta={cuenta} />
      <button type="button">Después</button>
      <SondaRuta />
    </MemoryRouter>,
  );
  return { ...resultado, persona: userEvent.setup() };
}

const marca = (nombre: string) => screen.getByRole("button", { name: nombre });
const ruta = () => screen.getByRole("status", { name: "Ruta actual" }).getAttribute("data-ruta");
const etiquetaVisible = (texto: string) => screen.queryByText(texto);

function sol(contenedor: HTMLElement): Element {
  const elemento = contenedor.querySelector("[data-atenuado]");
  if (!elemento) throw new Error("No se encontró el sol");
  return elemento;
}

describe("Horizonte", () => {
  describe("RF-14: grupo con nombre y un solo punto de tabulación", () => {
    it("es un grupo nombrado con la jornada, la hora y la cuenta", () => {
      montar();
      expect(screen.getByRole("group", { name: NOMBRE })).toBeInTheDocument();
    });

    it("sin cuenta todavía, el nombre es solo la jornada y la hora", () => {
      montar({ cuenta: null });
      expect(screen.getByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 14:20." })).toBeInTheDocument();
    });

    it("Tab entra en la primera marca, el siguiente Tab sale del grupo y Shift+Tab vuelve", async () => {
      const { persona } = montar();
      const grupo = screen.getByRole("group", { name: NOMBRE });
      expect(grupo).not.toHaveAttribute("tabindex");
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      expect(marca(RESUELTO_0830)).toHaveFocus();
      await persona.tab();
      expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
      await persona.tab({ shift: true });
      expect(marca(RESUELTO_0830)).toHaveFocus();
    });

    it("solo la marca activa tiene tabIndex 0", () => {
      montar();
      expect(marca(RESUELTO_0830)).toHaveAttribute("tabindex", "0");
      expect(marca(PROGRESO_1005)).toHaveAttribute("tabindex", "-1");
      expect(marca(ABIERTO_1205)).toHaveAttribute("tabindex", "-1");
    });

    it("las flechas, Inicio y Fin recorren las marcas sin dar la vuelta", async () => {
      const { persona } = montar();
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      await persona.keyboard("{ArrowRight}");
      expect(marca(PROGRESO_1005)).toHaveFocus();
      expect(marca(PROGRESO_1005)).toHaveAttribute("tabindex", "0");
      expect(marca(RESUELTO_0830)).toHaveAttribute("tabindex", "-1");
      await persona.keyboard("{ArrowDown}");
      expect(marca(ABIERTO_1205)).toHaveFocus();
      await persona.keyboard("{ArrowRight}");
      expect(marca(ABIERTO_1205)).toHaveFocus();
      await persona.keyboard("{Home}");
      expect(marca(RESUELTO_0830)).toHaveFocus();
      await persona.keyboard("{ArrowUp}");
      expect(marca(RESUELTO_0830)).toHaveFocus();
      await persona.keyboard("{End}");
      expect(marca(ABIERTO_1205)).toHaveFocus();
      await persona.keyboard("{ArrowLeft}");
      expect(marca(PROGRESO_1005)).toHaveFocus();
      await persona.keyboard("{ArrowUp}");
      expect(marca(RESUELTO_0830)).toHaveFocus();
    });

    it("al salir y volver con Tab, el foco vuelve a la última marca activa", async () => {
      const { persona } = montar();
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      await persona.keyboard("{End}");
      await persona.tab();
      expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
      await persona.tab({ shift: true });
      expect(marca(ABIERTO_1205)).toHaveFocus();
    });

    it("sin marcas, el grupo es el punto de tabulación", async () => {
      const { persona } = montar({ items: [], cuenta: "Hoy no entró ningún ticket." });
      const grupo = screen.getByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 14:20. Hoy no entró ningún ticket." });
      expect(grupo).toHaveAttribute("tabindex", "0");
      expect(within(grupo).queryByRole("button")).not.toBeInTheDocument();
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      expect(grupo).toHaveFocus();
    });
  });

  describe("RF-12: una marca por ticket, en su posición", () => {
    it("ordena las marcas por hora, con su estado y su nombre", () => {
      montar();
      const grupo = screen.getByRole("group", { name: NOMBRE });
      const marcas = within(grupo).getAllByRole("button");
      expect(marcas.map((m) => m.getAttribute("aria-label"))).toEqual([RESUELTO_0830, PROGRESO_1005, ABIERTO_1205]);
      expect(marcas.map((m) => m.getAttribute("data-estado"))).toEqual(["RESUELTO", "EN_PROGRESO", "ABIERTO"]);
      for (const m of marcas) expect(m).toHaveAttribute("type", "button");
    });

    it("ubica cada marca según su hora de creación", () => {
      montar();
      expect(marca(RESUELTO_0830).style.getPropertyValue("--tq-posicion")).toBe("5%");
      expect(marca(PROGRESO_1005).style.getPropertyValue("--tq-posicion")).toBe("20.83%");
      expect(marca(ABIERTO_1205).style.getPropertyValue("--tq-posicion")).toBe("40.83%");
    });

    it("una marca con hora fuera de la franja va al borde más cercano", () => {
      montar({
        items: [
          ticketResumenDe({ numero: 50, creado_en: "2026-11-17T10:30:00Z" }),
          ticketResumenDe({ numero: 51, creado_en: "2026-11-17T21:30:00Z" }),
        ],
        cuenta: "Hoy entraron 2 tickets.",
      });
      expect(marca("TQ-000050 · 07:30 · Abierto").style.getPropertyValue("--tq-posicion")).toBe("0%");
      expect(marca("TQ-000051 · 18:30 · Abierto").style.getPropertyValue("--tq-posicion")).toBe("100%");
    });

    it("dos tickets a la misma hora tienen dos marcas en el mismo lugar", () => {
      montar({
        items: [
          ticketResumenDe({ numero: 52, creado_en: "2026-11-17T15:05:00Z" }),
          ticketResumenDe({ numero: 53, estado: "CERRADO", creado_en: "2026-11-17T15:05:00Z" }),
        ],
        cuenta: "Hoy entraron 2 tickets.",
      });
      const primera = marca("TQ-000052 · 12:05 · Abierto");
      const segunda = marca("TQ-000053 · 12:05 · Cerrado");
      expect(segunda).toHaveAttribute("data-estado", "CERRADO");
      expect(primera.style.getPropertyValue("--tq-posicion")).toBe(segunda.style.getPropertyValue("--tq-posicion"));
    });
  });

  describe("RF-34: etiqueta y apertura", () => {
    it("la etiqueta aparece con el puntero encima y se va al salir", async () => {
      const { persona } = montar();
      expect(etiquetaVisible(ABIERTO_1205)).not.toBeInTheDocument();
      await persona.hover(marca(ABIERTO_1205));
      const etiqueta = screen.getByText(ABIERTO_1205);
      expect(etiqueta).toHaveAttribute("aria-hidden", "true");
      expect(etiquetaVisible(PROGRESO_1005)).not.toBeInTheDocument();
      await persona.unhover(marca(ABIERTO_1205));
      expect(etiquetaVisible(ABIERTO_1205)).not.toBeInTheDocument();
    });

    it("la etiqueta aparece con el foco y sigue al foco", async () => {
      const { persona } = montar();
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      expect(screen.getByText(RESUELTO_0830)).toHaveAttribute("aria-hidden", "true");
      await persona.keyboard("{ArrowRight}");
      expect(etiquetaVisible(RESUELTO_0830)).not.toBeInTheDocument();
      expect(screen.getByText(PROGRESO_1005)).toBeInTheDocument();
      await persona.tab();
      expect(etiquetaVisible(PROGRESO_1005)).not.toBeInTheDocument();
    });

    it("cerca de los bordes, la etiqueta se alinea al inicio o al final", async () => {
      const { persona } = montar({
        items: [
          ticketResumenDe({ numero: 50, creado_en: "2026-11-17T11:00:00Z" }),
          ticketResumenDe({ numero: 51, creado_en: "2026-11-17T16:00:00Z" }),
          ticketResumenDe({ numero: 52, creado_en: "2026-11-17T20:30:00Z" }),
        ],
        cuenta: "Hoy entraron 3 tickets.",
      });
      await persona.hover(marca("TQ-000050 · 08:00 · Abierto"));
      expect(screen.getByText("TQ-000050 · 08:00 · Abierto")).toHaveAttribute("data-alineacion", "inicio");
      await persona.hover(marca("TQ-000051 · 13:00 · Abierto"));
      expect(screen.getByText("TQ-000051 · 13:00 · Abierto")).toHaveAttribute("data-alineacion", "centro");
      await persona.hover(marca("TQ-000052 · 17:30 · Abierto"));
      expect(screen.getByText("TQ-000052 · 17:30 · Abierto")).toHaveAttribute("data-alineacion", "fin");
    });

    it("un clic abre el ticket", async () => {
      const { persona } = montar();
      expect(ruta()).toBe("/bandeja");
      await persona.click(marca(ABIERTO_1205));
      expect(ruta()).toBe("/tickets/49");
    });

    it("Enter abre el ticket de la marca con el foco", async () => {
      const { persona } = montar();
      await persona.click(screen.getByRole("button", { name: "Antes" }));
      await persona.tab();
      await persona.keyboard("{ArrowRight}");
      await persona.keyboard("{Enter}");
      expect(ruta()).toBe("/tickets/45");
    });

    it("en pantalla táctil, el primer toque muestra la etiqueta sin abrir y el segundo abre", async () => {
      const { persona } = montar();
      await persona.pointer({ keys: "[TouchA]", target: marca(ABIERTO_1205) });
      expect(screen.getByText(ABIERTO_1205)).toHaveAttribute("aria-hidden", "true");
      expect(ruta()).toBe("/bandeja");
      await persona.pointer({ keys: "[TouchA]", target: marca(ABIERTO_1205) });
      expect(ruta()).toBe("/tickets/49");
    });

    it("en pantalla táctil, tocar otra marca muestra la suya sin abrir", async () => {
      const { persona } = montar();
      await persona.pointer({ keys: "[TouchA]", target: marca(ABIERTO_1205) });
      await persona.pointer({ keys: "[TouchA]", target: marca(PROGRESO_1005) });
      expect(screen.getByText(PROGRESO_1005)).toBeInTheDocument();
      expect(etiquetaVisible(ABIERTO_1205)).not.toBeInTheDocument();
      expect(ruta()).toBe("/bandeja");
      await persona.pointer({ keys: "[TouchA]", target: marca(PROGRESO_1005) });
      expect(ruta()).toBe("/tickets/45");
    });
  });

  describe("RF-10 y RF-11: horas, tramo y sol", () => {
    it("muestra la hora de inicio y la de fin en los extremos, ocultas a lectores", () => {
      montar();
      const grupo = screen.getByRole("group", { name: NOMBRE });
      expect(within(grupo).getByText("08:00")).toHaveAttribute("aria-hidden", "true");
      expect(within(grupo).getByText("18:00")).toHaveAttribute("aria-hidden", "true");
    });

    it("el tramo transcurrido y el sol llegan a la hora actual", () => {
      const { container } = montar();
      expect(screen.getByRole("group", { name: NOMBRE }).style.getPropertyValue("--tq-avance")).toBe("63.33%");
      expect(sol(container)).toHaveAttribute("aria-hidden", "true");
    });

    it("antes del inicio, el tramo y el sol quedan en el borde izquierdo", () => {
      montar({ ahora: "2026-11-17T10:00:00Z", items: [], cuenta: null });
      expect(screen.getByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 07:00." }).style.getPropertyValue("--tq-avance")).toBe("0%");
    });

    it("después del fin, el tramo y el sol quedan en el borde derecho", () => {
      montar({ ahora: "2026-11-17T22:00:00Z", items: [], cuenta: null });
      expect(screen.getByRole("group", { name: "Jornada de 08:00 a 18:00. Son las 19:00." }).style.getPropertyValue("--tq-avance")).toBe("100%");
    });

    it("con la jornada abierta, el sol no está atenuado", () => {
      const { container } = montar();
      expect(sol(container)).toHaveAttribute("data-atenuado", "false");
    });

    it("con la jornada cerrada, el sol está atenuado", () => {
      const { container } = montar({ ahora: "2026-11-17T22:30:00Z", items: [], cuenta: null });
      expect(sol(container)).toHaveAttribute("data-atenuado", "true");
    });

    it("en por cerrar, el sol sigue sin atenuar", () => {
      const { container } = montar({ ahora: "2026-11-17T20:48:00Z", items: [], cuenta: null });
      expect(sol(container)).toHaveAttribute("data-atenuado", "false");
    });
  });
});
