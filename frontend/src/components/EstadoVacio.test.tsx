import { render, screen } from "@testing-library/react";
import { Lock, SearchX } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EnlaceBoton } from "./Boton";
import { EstadoVacio } from "./EstadoVacio";

function montar(titulo: string, icono: typeof Lock, nivel?: 1 | 2) {
  return render(
    <MemoryRouter>
      <EstadoVacio
        icono={icono}
        titulo={titulo}
        nivel={nivel}
        accion={
          <EnlaceBoton to="/bandeja" variante="primario">
            Volver a Tickets
          </EnlaceBoton>
        }
      />
    </MemoryRouter>,
  );
}

describe("EstadoVacio", () => {
  it("RF-24: título 'No tenés acceso a esta sección' y la acción 'Volver a Tickets'", () => {
    montar("No tenés acceso a esta sección", Lock);
    expect(screen.getByRole("heading", { level: 1, name: "No tenés acceso a esta sección" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("href", "/bandeja");
  });

  it("RF-35: título 'Esta página no existe.' y la acción 'Volver a Tickets'", () => {
    montar("Esta página no existe.", SearchX);
    expect(screen.getByRole("heading", { level: 1, name: "Esta página no existe." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("href", "/bandeja");
  });

  it("el ícono es decorativo, con trazo 1.75", () => {
    const { container } = montar("No tenés acceso a esta sección", Lock);
    const icono = container.querySelector('[aria-hidden="true"]');
    expect(icono?.tagName.toLowerCase()).toBe("svg");
    expect(icono).toHaveAttribute("stroke-width", "1.75");
  });

  it("el título va antes de la acción", () => {
    montar("No tenés acceso a esta sección", Lock);
    const titulo = screen.getByRole("heading", { level: 1 });
    const accion = screen.getByRole("link", { name: "Volver a Tickets" });
    expect(titulo.compareDocumentPosition(accion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("RF-10 y RF-26: con nivel 2, el título es un h2 (debajo del h1 de la pantalla)", () => {
    montar("No hay tickets", SearchX, 2);
    expect(screen.getByRole("heading", { level: 2, name: "No hay tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("con nivel 1 explícito sigue siendo un h1", () => {
    montar("Este ticket no existe.", SearchX, 1);
    expect(screen.getByRole("heading", { level: 1, name: "Este ticket no existe." })).toBeInTheDocument();
  });
});
