import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Prioridad } from "../api/types";
import { MarcaPrioridad } from "./MarcaPrioridad";
import css from "./MarcaPrioridad.module.css?raw";

function reglaDe(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regla = new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  if (!regla?.[1]) throw new Error(`No está la regla ${selector}`);
  return regla[1];
}

function enUnEnlace(prioridad: Prioridad, conNombre = false) {
  return render(
    <a href="/tickets/45">
      <MarcaPrioridad prioridad={prioridad} conNombre={conNombre} />
    </a>,
  );
}

describe("MarcaPrioridad", () => {
  it.each<[Prioridad, string, string]>([
    ["BAJA", "", "Prioridad baja"],
    ["MEDIA", "!", "Prioridad media"],
    ["ALTA", "!!", "Prioridad alta"],
    ["CRITICA", "!!!", "Prioridad crítica"],
  ])("RF-4: %s muestra '%s' y se lee '%s'", (prioridad, marca, nombre) => {
    const { container } = enUnEnlace(prioridad);
    expect(screen.getByRole("link", { name: nombre })).toBeInTheDocument();
    const decorativa = container.querySelector('[aria-hidden="true"]');
    if (marca === "") expect(decorativa).not.toBeInTheDocument();
    else expect(decorativa).toHaveTextContent(new RegExp(`^${marca}$`));
  });

  it("RF-4: sin conNombre, el nombre queda oculto a la vista pero se lee", () => {
    enUnEnlace("ALTA");
    const nombre = screen.getByText("Prioridad alta");
    expect(nombre).toHaveAttribute("data-oculto", "true");
    const oculto = reglaDe('.nombre[data-oculto="true"]');
    expect(oculto).toMatch(/position:\s*absolute;/);
    expect(oculto).toMatch(/width:\s*1px;/);
    expect(oculto).toMatch(/clip-path:\s*inset\(50%\);/);
  });

  it("RF-19: con conNombre, la marca y el nombre visible", () => {
    const { container } = enUnEnlace("ALTA", true);
    expect(screen.getByRole("link", { name: "Prioridad alta" })).toBeInTheDocument();
    expect(screen.getByText("Prioridad alta")).not.toHaveAttribute("data-oculto");
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("!!");
  });

  it("RF-19: Baja con conNombre muestra solo el nombre", () => {
    const { container } = enUnEnlace("BAJA", true);
    expect(container).toHaveTextContent(/^Prioridad baja$/);
  });

  it("RF-4: Crítica va en peligro, con la prioridad en data-prioridad", () => {
    enUnEnlace("CRITICA");
    expect(screen.getByText("Prioridad crítica").closest("[data-prioridad]")).toHaveAttribute(
      "data-prioridad",
      "CRITICA",
    );
    expect(reglaDe('.prioridad[data-prioridad="CRITICA"]')).toMatch(/color:\s*var\(--tq-peligro\);/);
  });
});
