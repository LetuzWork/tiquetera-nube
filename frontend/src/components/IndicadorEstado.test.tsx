import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Estado } from "../api/types";
import { IndicadorEstado } from "./IndicadorEstado";
import css from "./IndicadorEstado.module.css?raw";

describe("IndicadorEstado", () => {
  it.each<[Estado, string]>([
    ["ABIERTO", "Abierto"],
    ["EN_PROGRESO", "En progreso"],
    ["RESUELTO", "Resuelto"],
    ["CERRADO", "Cerrado"],
  ])("RF-4: %s se lee como '%s', con el estado en data-estado", (estado, nombre) => {
    render(
      <button type="button">
        <IndicadorEstado estado={estado} />
      </button>,
    );
    expect(screen.getByRole("button", { name: nombre })).toBeInTheDocument();
    expect(screen.getByText(nombre).closest("[data-estado]")).toHaveAttribute("data-estado", estado);
  });

  it("RNF-1: el punto es decorativo y el nombre está escrito: el estado nunca va solo con color", () => {
    const { container } = render(<IndicadorEstado estado="EN_PROGRESO" />);
    const punto = container.querySelector('[aria-hidden="true"]');
    expect(punto).toBeInTheDocument();
    expect(punto).toBeEmptyDOMElement();
    expect(container).toHaveTextContent("En progreso");
  });

  it("cada estado tiene su color de punto", () => {
    expect(css).toMatch(/\.indicador\s*\{[^}]*--tq-color-estado:\s*var\(--tq-estado-abierto\)/);
    expect(css).toMatch(/\[data-estado="EN_PROGRESO"\]\s*\{[^}]*var\(--tq-estado-progreso\)/);
    expect(css).toMatch(/\[data-estado="RESUELTO"\]\s*\{[^}]*var\(--tq-estado-resuelto\)/);
    expect(css).toMatch(/\[data-estado="CERRADO"\]\s*\{[^}]*var\(--tq-estado-cerrado\)/);
  });
});
