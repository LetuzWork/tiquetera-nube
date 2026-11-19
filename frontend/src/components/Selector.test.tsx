import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Categoria } from "../api/types";
import { Selector, type OpcionSelector } from "./Selector";

type ValorCategoria = Categoria | "";

const CATEGORIAS: OpcionSelector<ValorCategoria>[] = [
  { valor: "", etiqueta: "Todas" },
  { valor: "Hardware", etiqueta: "Hardware" },
  { valor: "Software", etiqueta: "Software" },
  { valor: "Red", etiqueta: "Red" },
  { valor: "Accesos", etiqueta: "Accesos" },
  { valor: "Otro", etiqueta: "Otro" },
];

function SelectorControlado({ alCambiar }: { alCambiar: (valor: ValorCategoria) => void }) {
  const [valor, setValor] = useState<ValorCategoria>("");
  return (
    <Selector
      etiqueta="Categoría"
      opciones={CATEGORIAS}
      valor={valor}
      alCambiar={(nuevo) => {
        alCambiar(nuevo);
        setValor(nuevo);
      }}
    />
  );
}

describe("Selector", () => {
  it("RF-7: un select nativo con su etiqueta, sus opciones y el valor elegido", () => {
    render(<Selector etiqueta="Categoría" opciones={CATEGORIAS} valor="Red" alCambiar={() => undefined} />);
    const selector = screen.getByRole("combobox", { name: "Categoría" });
    expect(selector.tagName.toLowerCase()).toBe("select");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todas",
      "Hardware",
      "Software",
      "Red",
      "Accesos",
      "Otro",
    ]);
    expect(selector).toHaveValue("Red");
    expect(screen.getByRole("option", { name: "Red" })).toHaveProperty("selected", true);
    expect(selector).not.toHaveAttribute("aria-invalid");
    expect(selector).not.toHaveAttribute("aria-describedby");
  });

  it("RF-7: elegir una opción avisa su valor, también 'Todas' con el valor vacío", async () => {
    const alCambiar = vi.fn();
    render(<SelectorControlado alCambiar={alCambiar} />);
    const persona = userEvent.setup();
    const selector = screen.getByRole("combobox", { name: "Categoría" });
    await persona.selectOptions(selector, "Accesos");
    expect(selector).toHaveValue("Accesos");
    await persona.selectOptions(selector, "Todas");
    expect(selector).toHaveValue("");
    expect(alCambiar.mock.calls).toEqual([["Accesos"], [""]]);
  });

  it("se maneja con teclado, como cualquier select", async () => {
    const alCambiar = vi.fn();
    render(<SelectorControlado alCambiar={alCambiar} />);
    const persona = userEvent.setup();
    await persona.tab();
    expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveFocus();
  });

  it("una opción deshabilitada queda deshabilitada", () => {
    render(
      <Selector
        etiqueta="Estado"
        opciones={[
          { valor: "ABIERTO", etiqueta: "Abierto" },
          { valor: "CERRADO", etiqueta: "Cerrado", deshabilitada: true },
        ]}
        valor="ABIERTO"
        alCambiar={() => undefined}
      />,
    );
    expect(screen.getByRole("option", { name: "Cerrado" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Abierto" })).toBeEnabled();
  });

  it("con la etiqueta oculta conserva el nombre accesible", () => {
    render(<Selector etiqueta="Prioridad" etiquetaOculta opciones={CATEGORIAS} valor="" alCambiar={() => undefined} />);
    expect(screen.getByRole("combobox", { name: "Prioridad" })).toBeInTheDocument();
    expect(screen.getByText("Prioridad")).toHaveAttribute("data-oculta", "true");
  });

  it("el error va debajo, con aria-invalid y aria-describedby", () => {
    render(
      <Selector etiqueta="Categoría" opciones={CATEGORIAS} valor="" alCambiar={() => undefined} error="Elegí una categoría." />,
    );
    const selector = screen.getByRole("combobox", { name: "Categoría" });
    expect(selector).toHaveAttribute("aria-invalid", "true");
    expect(selector).toHaveAccessibleDescription("Elegí una categoría.");
    expect(selector).toHaveAttribute("aria-describedby", screen.getByText("Elegí una categoría.").id);
  });

  it("RF-23: pasa disabled y name, y la referencia al <select>", () => {
    const referencia = createRef<HTMLSelectElement>();
    render(
      <Selector
        etiqueta="Estado"
        opciones={CATEGORIAS}
        valor=""
        alCambiar={() => undefined}
        referencia={referencia}
        name="categoria"
        disabled
      />,
    );
    const selector = screen.getByRole("combobox", { name: "Estado" });
    expect(selector).toBeDisabled();
    expect(selector).toHaveAttribute("name", "categoria");
    expect(referencia.current).toBe(selector);
  });

  it("la referencia sirve para enfocarlo", () => {
    const referencia = createRef<HTMLSelectElement>();
    render(<Selector etiqueta="Estado" opciones={CATEGORIAS} valor="" alCambiar={() => undefined} referencia={referencia} />);
    act(() => referencia.current?.focus());
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveFocus();
  });
});
