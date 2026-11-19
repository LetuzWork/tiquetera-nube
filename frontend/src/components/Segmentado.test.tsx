import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Segmentado, type OpcionSegmentado } from "./Segmentado";

type Filtro = "todos" | "ABIERTO" | "EN_PROGRESO" | "RESUELTO" | "CERRADO";

const OPCIONES: OpcionSegmentado<Filtro>[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "ABIERTO", etiqueta: "Abiertos" },
  { valor: "EN_PROGRESO", etiqueta: "En progreso" },
  { valor: "RESUELTO", etiqueta: "Resueltos" },
  { valor: "CERRADO", etiqueta: "Cerrados" },
];

interface PropsPrueba {
  inicial?: Filtro;
  alCambiar?: (valor: Filtro) => void;
  etiquetaVisible?: boolean;
  deshabilitado?: boolean;
}

function SegmentadoControlado({ inicial = "todos", alCambiar = () => undefined, ...resto }: PropsPrueba) {
  const [valor, setValor] = useState<Filtro>(inicial);
  return (
    <>
      <button type="button">Antes</button>
      <Segmentado
        etiqueta="Estado"
        opciones={OPCIONES}
        valor={valor}
        alCambiar={(nuevo) => {
          alCambiar(nuevo);
          setValor(nuevo);
        }}
        {...resto}
      />
      <button type="button">Después</button>
    </>
  );
}

function montar(props: PropsPrueba = {}) {
  const alCambiar = vi.fn<(valor: Filtro) => void>();
  render(<SegmentadoControlado alCambiar={alCambiar} {...props} />);
  return { alCambiar, persona: userEvent.setup() };
}

const opcion = (nombre: string) => screen.getByRole("radio", { name: nombre });

function elegidas(): string[] {
  return screen
    .getAllByRole("radio")
    .filter((radio) => radio.getAttribute("aria-checked") === "true")
    .map((radio) => radio.textContent ?? "");
}

describe("Segmentado", () => {
  it("RF-6: es un radiogroup con nombre y una opción por valor, con la elegida marcada", () => {
    montar({ inicial: "ABIERTO" });
    const grupo = screen.getByRole("radiogroup", { name: "Estado" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Todos",
      "Abiertos",
      "En progreso",
      "Resueltos",
      "Cerrados",
    ]);
    expect(opcion("Abiertos")).toBeChecked();
    expect(elegidas()).toEqual(["Abiertos"]);
  });

  it("RNF-3: es un solo punto de tabulación, el de la opción elegida", async () => {
    const { persona } = montar({ inicial: "EN_PROGRESO" });
    act(() => screen.getByRole("button", { name: "Antes" }).focus());
    await persona.tab();
    expect(opcion("En progreso")).toHaveFocus();
    await persona.tab();
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
    await persona.tab({ shift: true });
    expect(opcion("En progreso")).toHaveFocus();
    expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
  });

  it("RF-6: → y ↓ mueven el foco y eligen la siguiente; al final dan la vuelta", async () => {
    const { persona, alCambiar } = montar({ inicial: "RESUELTO" });
    act(() => opcion("Resueltos").focus());
    await persona.keyboard("{ArrowRight}");
    expect(opcion("Cerrados")).toHaveFocus();
    expect(opcion("Cerrados")).toBeChecked();
    await persona.keyboard("{ArrowDown}");
    expect(opcion("Todos")).toHaveFocus();
    expect(elegidas()).toEqual(["Todos"]);
    expect(alCambiar.mock.calls).toEqual([["CERRADO"], ["todos"]]);
  });

  it("RF-6: ← y ↑ mueven el foco y eligen la anterior; al principio dan la vuelta", async () => {
    const { persona, alCambiar } = montar({ inicial: "ABIERTO" });
    act(() => opcion("Abiertos").focus());
    await persona.keyboard("{ArrowLeft}");
    expect(opcion("Todos")).toHaveFocus();
    expect(opcion("Todos")).toBeChecked();
    await persona.keyboard("{ArrowUp}");
    expect(opcion("Cerrados")).toHaveFocus();
    expect(elegidas()).toEqual(["Cerrados"]);
    expect(alCambiar.mock.calls).toEqual([["todos"], ["CERRADO"]]);
  });

  it("Inicio y Fin van a los extremos", async () => {
    const { persona, alCambiar } = montar({ inicial: "EN_PROGRESO" });
    act(() => opcion("En progreso").focus());
    await persona.keyboard("{End}");
    expect(opcion("Cerrados")).toHaveFocus();
    expect(opcion("Cerrados")).toBeChecked();
    await persona.keyboard("{Home}");
    expect(opcion("Todos")).toHaveFocus();
    expect(opcion("Todos")).toBeChecked();
    expect(alCambiar.mock.calls).toEqual([["CERRADO"], ["todos"]]);
  });

  it("el punto de tabulación sigue a la elegida", async () => {
    const { persona } = montar();
    act(() => opcion("Todos").focus());
    await persona.keyboard("{ArrowRight}{ArrowRight}");
    expect(opcion("En progreso")).toHaveAttribute("tabindex", "0");
    expect(opcion("Todos")).toHaveAttribute("tabindex", "-1");
  });

  it("un clic elige; tocar la elegida no avisa de nuevo", async () => {
    const { persona, alCambiar } = montar();
    await persona.click(opcion("Resueltos"));
    expect(opcion("Resueltos")).toBeChecked();
    expect(opcion("Resueltos")).toHaveFocus();
    await persona.click(opcion("Resueltos"));
    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(alCambiar).toHaveBeenCalledWith("RESUELTO");
  });

  it("otra tecla no hace nada", async () => {
    const { persona, alCambiar } = montar();
    act(() => opcion("Todos").focus());
    await persona.keyboard("a");
    expect(opcion("Todos")).toHaveFocus();
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("RF-14: con la etiqueta visible, el grupo se nombra por ella", () => {
    render(
      <Segmentado
        etiqueta="Prioridad"
        etiquetaVisible
        opciones={[
          { valor: "BAJA", etiqueta: "Baja" },
          { valor: "MEDIA", etiqueta: "Media" },
        ]}
        valor="MEDIA"
        alCambiar={() => undefined}
      />,
    );
    const grupo = screen.getByRole("radiogroup", { name: "Prioridad" });
    const etiqueta = screen.getByText("Prioridad");
    expect(grupo).toHaveAttribute("aria-labelledby", etiqueta.id);
    expect(grupo).not.toHaveAttribute("aria-label");
    expect(screen.getByRole("radio", { name: "Media" })).toBeChecked();
  });

  it("sin la etiqueta visible, el nombre va en aria-label y no se ve", () => {
    montar();
    expect(screen.getByRole("radiogroup", { name: "Estado" })).toHaveAttribute("aria-label", "Estado");
    expect(screen.queryByText("Estado")).not.toBeInTheDocument();
  });

  it("deshabilitado, ni las flechas ni el clic cambian el valor", async () => {
    const { persona, alCambiar } = montar({ deshabilitado: true });
    expect(screen.getByRole("radiogroup", { name: "Estado" })).toHaveAttribute("aria-disabled", "true");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    await persona.click(opcion("Cerrados"));
    fireEvent.keyDown(opcion("Todos"), { key: "ArrowRight" });
    fireEvent.keyDown(opcion("Todos"), { key: "End" });
    expect(alCambiar).not.toHaveBeenCalled();
    expect(opcion("Todos")).toBeChecked();
  });

  it("con un valor que no está entre las opciones, la primera queda como punto de tabulación", () => {
    render(<Segmentado etiqueta="Estado" opciones={OPCIONES} valor={"OTRO" as Filtro} alCambiar={() => undefined} />);
    expect(elegidas()).toEqual([]);
    expect(opcion("Todos")).toHaveAttribute("tabindex", "0");
  });
});
