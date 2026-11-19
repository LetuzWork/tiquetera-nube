import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Vidrio } from "./Vidrio";
import css from "./Vidrio.module.css?raw";

function reglaDe(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regla = new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  if (!regla?.[1]) throw new Error(`No está la regla ${selector}`);
  return regla[1];
}

function contenidoDe(boton: HTMLElement): Element {
  const contenido = boton.closest("[data-desenfocado]");
  if (!contenido) throw new Error("El contenido del vidrio no tiene data-desenfocado");
  return contenido;
}

describe("Vidrio", () => {
  it("es el <main> con la sección adentro", () => {
    render(
      <Vidrio>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    const principal = screen.getByRole("main");
    expect(within(principal).getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("sin desenfocar, el contenido se puede usar", () => {
    render(
      <Vidrio>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    const contenido = contenidoDe(screen.getByRole("button", { name: "Guardar" }));
    expect(contenido).toHaveAttribute("data-desenfocado", "false");
    expect(contenido).not.toHaveAttribute("inert");
    expect(contenido).not.toHaveAttribute("aria-hidden");
  });

  it("RF-22 y RNF-5: desenfocado, el contenido recibe inert y aria-hidden", () => {
    render(
      <Vidrio desenfocado>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    const contenido = contenidoDe(screen.getByRole("button", { name: "Guardar", hidden: true }));
    expect(contenido).toHaveAttribute("data-desenfocado", "true");
    expect(contenido).toHaveAttribute("inert");
    expect(contenido).toHaveAttribute("aria-hidden", "true");
    const principal = screen.getByRole("main");
    expect(principal).not.toHaveAttribute("inert");
    expect(principal).not.toHaveAttribute("aria-hidden");
  });

  it("al volver a enfocar, se quitan inert y aria-hidden", () => {
    const { rerender } = render(
      <Vidrio desenfocado>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    rerender(
      <Vidrio desenfocado={false}>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    const contenido = contenidoDe(screen.getByRole("button", { name: "Guardar" }));
    expect(contenido).toHaveAttribute("data-desenfocado", "false");
    expect(contenido).not.toHaveAttribute("inert");
    expect(contenido).not.toHaveAttribute("aria-hidden");
  });

  describe("variantes", () => {
    it("por omisión es la del marco, ancho y superpuesto al cielo", () => {
      render(
        <Vidrio>
          <button type="button">Guardar</button>
        </Vidrio>,
      );
      expect(screen.getByRole("main")).toHaveAttribute("data-variante", "marco");
      const base = reglaDe(".vidrio");
      expect(base).toContain("width: min(72rem, 100% - 2rem)");
      expect(base).toContain("margin: -3.5rem auto 2rem");
    });

    it("la angosta, para el inicio de sesión, lleva data-variante y se desenfoca igual", () => {
      render(
        <Vidrio variante="angosta" desenfocado>
          <button type="button">Guardar</button>
        </Vidrio>,
      );
      const principal = screen.getByRole("main");
      expect(principal).toHaveAttribute("data-variante", "angosta");
      const contenido = contenidoDe(within(principal).getByRole("button", { name: "Guardar", hidden: true }));
      expect(contenido).toHaveAttribute("inert");
      expect(contenido).toHaveAttribute("aria-hidden", "true");
    });

    it("la angosta mide min(24rem, 100% - 2rem) y no se superpone", () => {
      const angosta = reglaDe('.vidrio[data-variante="angosta"]');
      expect(angosta).toContain("width: min(24rem, 100% - 2rem)");
      expect(angosta).toContain("margin: 0 auto");
      expect(angosta).not.toContain("-3.5rem");
    });

    it("el vidrio pone su propio color de texto, así sobre un cielo oscuro se sigue leyendo", () => {
      expect(reglaDe(".vidrio")).toContain("color: var(--tq-texto)");
    });
  });

  it("React no avisa nada en consola por inert", () => {
    const error = vi.spyOn(console, "error");
    const { rerender } = render(
      <Vidrio desenfocado>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    rerender(
      <Vidrio>
        <button type="button">Guardar</button>
      </Vidrio>,
    );
    expect(contenidoDe(screen.getByRole("button", { name: "Guardar" }))).not.toHaveAttribute("inert");
    expect(error).not.toHaveBeenCalled();
  });
});
