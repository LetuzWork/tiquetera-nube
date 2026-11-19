import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlidersHorizontal } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Desplegable } from "./Desplegable";

function montar(props: { alineacion?: "inicio" | "fin" } = {}) {
  render(
    <>
      <button type="button">Antes</button>
      <p>Texto de la página</p>
      <Desplegable texto="Filtros · 2" icono={SlidersHorizontal} {...props}>
        {(cerrar) => (
          <>
            <label>
              Prioridad
              <select defaultValue="">
                <option value="">Todas</option>
                <option value="ALTA">Alta</option>
              </select>
            </label>
            <label>
              <input type="checkbox" /> Solo los asignados a mí
            </label>
            <button type="button" onClick={cerrar}>
              Listo
            </button>
          </>
        )}
      </Desplegable>
      <button type="button">Después</button>
    </>,
  );
  return { boton: screen.getByRole("button", { name: "Filtros · 2" }), persona: userEvent.setup() };
}

const panel = () => screen.queryByRole("group", { name: "Filtros · 2" });

function cerrado(boton: HTMLElement) {
  expect(boton).toHaveAttribute("aria-expanded", "false");
  expect(panel()).not.toBeInTheDocument();
}

describe("Desplegable", () => {
  it("RF-7: cerrado, es un botón con su texto, aria-expanded y el panel oculto", () => {
    const { boton } = montar();
    expect(boton).toHaveAttribute("type", "button");
    expect(boton).toHaveTextContent("Filtros · 2");
    cerrado(boton);
    expect(screen.queryByRole("combobox", { name: "Prioridad" })).not.toBeInTheDocument();
  });

  it("el ícono es decorativo, con trazo 1.75", () => {
    const { boton } = montar();
    const icono = boton.querySelector('[aria-hidden="true"]');
    expect(icono?.tagName.toLowerCase()).toBe("svg");
    expect(icono).toHaveAttribute("stroke-width", "1.75");
  });

  it("RF-7: un clic abre un grupo no modal nombrado por el botón; el foco queda en el botón", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    const grupo = panel();
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(grupo).toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-controls", grupo?.id);
    expect(grupo).not.toHaveAttribute("aria-modal");
    expect(boton).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Prioridad" })).toBeVisible();
  });

  it("otro clic en el botón lo cierra", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.click(boton);
    cerrado(boton);
    expect(boton).toHaveFocus();
  });

  it("RNF-3: con teclado, Enter abre y Tab entra al panel", async () => {
    const { boton, persona } = montar();
    act(() => boton.focus());
    await persona.keyboard("{Enter}");
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await persona.tab();
    expect(screen.getByRole("combobox", { name: "Prioridad" })).toHaveFocus();
    await persona.tab();
    expect(screen.getByRole("checkbox", { name: "Solo los asignados a mí" })).toHaveFocus();
    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("RNF-3: Esc desde adentro cierra y devuelve el foco al botón", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    expect(screen.getByRole("combobox", { name: "Prioridad" })).toHaveFocus();
    await persona.keyboard("{Escape}");
    cerrado(boton);
    expect(boton).toHaveFocus();
  });

  it("Esc en el botón también cierra", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.keyboard("{Escape}");
    cerrado(boton);
    expect(boton).toHaveFocus();
  });

  it("un clic afuera, en otro control, cierra y no le saca el foco a ese control", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    await persona.click(screen.getByRole("button", { name: "Después" }));
    cerrado(boton);
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("RF-7 y RNF-3: un clic afuera, en el texto de la página, cierra y devuelve el foco al botón", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    const prioridad = screen.getByRole("combobox", { name: "Prioridad" });
    expect(prioridad).toHaveFocus();
    await persona.click(screen.getByText("Texto de la página"));
    cerrado(boton);
    expect(boton).toHaveFocus();
    await persona.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("RF-7 y RNF-3: con el foco en el botón, un clic afuera en el texto cierra y el foco sigue en el botón", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    expect(boton).toHaveFocus();
    await persona.click(screen.getByText("Texto de la página"));
    cerrado(boton);
    expect(boton).toHaveFocus();
  });

  it("después de un clic afuera que vuelve al botón, otro clic en el texto deja el foco donde lo pone el navegador", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    await persona.click(screen.getByText("Texto de la página"));
    expect(boton).toHaveFocus();
    await persona.click(screen.getByText("Texto de la página"));
    expect(document.activeElement).toBe(document.body);
  });

  it("un clic adentro del panel no lo cierra", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.click(screen.getByRole("checkbox", { name: "Solo los asignados a mí" }));
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: "Solo los asignados a mí" })).toBeChecked();
  });

  it("Tab hacia afuera desde el último control cierra y el foco sigue su camino", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    await persona.tab();
    await persona.tab();
    expect(screen.getByRole("button", { name: "Listo" })).toHaveFocus();
    await persona.tab();
    cerrado(boton);
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
  });

  it("Shift+Tab desde el botón abierto cierra", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab({ shift: true });
    cerrado(boton);
    expect(screen.getByRole("button", { name: "Antes" })).toHaveFocus();
  });

  it("Shift+Tab desde el panel vuelve al botón sin cerrar", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.tab();
    await persona.tab({ shift: true });
    expect(boton).toHaveFocus();
    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("el contenido recibe 'cerrar', que cierra y devuelve el foco al botón", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    await persona.click(screen.getByRole("button", { name: "Listo" }));
    cerrado(boton);
    expect(boton).toHaveFocus();
  });

  it("acepta contenido común y la alineación", async () => {
    render(
      <Desplegable texto="Opciones" alineacion="inicio">
        <p>Contenido fijo</p>
      </Desplegable>,
    );
    const persona = userEvent.setup();
    await persona.click(screen.getByRole("button", { name: "Opciones" }));
    const grupo = screen.getByRole("group", { name: "Opciones" });
    expect(grupo).toHaveTextContent("Contenido fijo");
    expect(grupo).toHaveAttribute("data-alineacion", "inicio");
  });

  it("se alinea al final por omisión", async () => {
    const { boton, persona } = montar();
    await persona.click(boton);
    expect(panel()).toHaveAttribute("data-alineacion", "fin");
  });
});
