import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { auth } from "../api/endpoints";
import type { Rol } from "../api/types";
import { ProveedorAuth } from "../auth/AuthContext";
import { meDe } from "../test/fabricas";
import { SondaRuta } from "../test/render";
import { Navegacion } from "./Navegacion";

async function montar(rol: Rol, ruta = "/bandeja", etiqueta?: string) {
  vi.spyOn(auth, "me").mockResolvedValue(meDe(rol));
  await act(async () => {
    render(
      <ProveedorAuth>
        <MemoryRouter initialEntries={[ruta]}>
          {etiqueta === undefined ? <Navegacion /> : <Navegacion etiqueta={etiqueta} />}
          <SondaRuta />
        </MemoryRouter>
      </ProveedorAuth>,
    );
  });
  return { persona: userEvent.setup() };
}

function enlaces(nombre = "Secciones"): HTMLElement[] {
  return within(screen.getByRole("navigation", { name: nombre })).getAllByRole("link");
}

const nombres = (lista: HTMLElement[]) => lista.map((enlace) => enlace.textContent);

function activos(nombre = "Secciones"): (string | null)[] {
  return enlaces(nombre)
    .filter((enlace) => enlace.getAttribute("aria-current") === "page")
    .map((enlace) => enlace.textContent);
}

describe("Navegacion", () => {
  describe("RF-17: secciones según el rol", () => {
    it.each<[Rol, string[]]>([
      ["admin", ["Tickets", "Nuevo ticket", "Reportes"]],
      ["operador", ["Tickets", "Nuevo ticket", "Reportes"]],
      ["usuario", ["Tickets", "Nuevo ticket"]],
      ["consulta", ["Tickets", "Reportes"]],
    ])("%s ve %j", async (rol, esperadas) => {
      await montar(rol);
      expect(nombres(enlaces())).toEqual(esperadas);
    });

    it("cada enlace lleva a su ruta", async () => {
      await montar("admin");
      expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("href", "/bandeja");
      expect(screen.getByRole("link", { name: "Nuevo ticket" })).toHaveAttribute("href", "/tickets/nuevo");
      expect(screen.getByRole("link", { name: "Reportes" })).toHaveAttribute("href", "/reportes");
    });
  });

  describe("RF-14 y RF-8: 'Nuevo ticket' conserva la vista de la bandeja", () => {
    it.each([
      ["/bandeja?estado=ABIERTO&q=vpn", "/tickets/nuevo?estado=ABIERTO&q=vpn"],
      ["/tickets/nuevo?estado=ABIERTO", "/tickets/nuevo?estado=ABIERTO"],
      ["/reportes?periodo=7", "/tickets/nuevo"],
      ["/tickets/45?estado=ABIERTO", "/tickets/nuevo"],
    ])("en %s lleva a %s", async (ruta, destino) => {
      await montar("operador", ruta);
      expect(screen.getByRole("link", { name: "Nuevo ticket" })).toHaveAttribute("href", destino);
      expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("href", "/bandeja");
      expect(screen.getByRole("link", { name: "Reportes" })).toHaveAttribute("href", "/reportes");
    });
  });

  describe("RF-17: la sección actual", () => {
    it.each([
      ["/bandeja", "Tickets"],
      ["/tickets/45", "Tickets"],
      ["/tickets/nuevo", "Nuevo ticket"],
      ["/reportes", "Reportes"],
    ])("en %s marca %s con aria-current", async (ruta, activa) => {
      await montar("admin", ruta);
      expect(activos()).toEqual([activa]);
    });

    it("en una ruta sin sección no marca ninguna", async () => {
      await montar("admin", "/otra");
      expect(activos()).toEqual([]);
    });

    it("al navegar, la marca pasa a la sección nueva", async () => {
      const { persona } = await montar("operador");
      await persona.click(screen.getByRole("link", { name: "Reportes" }));
      expect(screen.getByRole("status", { name: "Ruta actual" })).toHaveAttribute("data-ruta", "/reportes");
      expect(activos()).toEqual(["Reportes"]);
    });
  });

  describe("nombre accesible", () => {
    it("por omisión es 'Secciones'", async () => {
      await montar("operador");
      expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
    });

    it("en la barra fija es 'Secciones, barra fija'", async () => {
      await montar("operador", "/reportes", "Secciones, barra fija");
      expect(screen.queryByRole("navigation", { name: "Secciones" })).not.toBeInTheDocument();
      expect(activos("Secciones, barra fija")).toEqual(["Reportes"]);
    });
  });
});
