import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { AreaTexto, type PropsAreaTexto } from "./AreaTexto";

function AreaControlada(props: Omit<PropsAreaTexto, "value" | "onChange"> & { inicial?: string }) {
  const { inicial = "", ...resto } = props;
  const [valor, setValor] = useState(inicial);
  return <AreaTexto {...resto} value={valor} onChange={(evento) => setValor(evento.target.value)} />;
}

describe("AreaTexto", () => {
  it("RF-14: un área de texto con su etiqueta y 5 filas por omisión", () => {
    render(<AreaControlada etiqueta="Descripción" />);
    const area = screen.getByRole("textbox", { name: "Descripción" });
    expect(area.tagName.toLowerCase()).toBe("textarea");
    expect(area).toHaveAttribute("rows", "5");
    expect(area).not.toHaveAttribute("aria-invalid");
    expect(area).not.toHaveAttribute("aria-describedby");
  });

  it("RF-14: con contador y maxLength muestra '0/5000' y lo usa como descripción", () => {
    render(<AreaControlada etiqueta="Descripción" contador maxLength={5000} />);
    const area = screen.getByRole("textbox", { name: "Descripción" });
    const contador = screen.getByText("0/5000");
    expect(area).toHaveAttribute("aria-describedby", contador.id);
    expect(area).toHaveAccessibleDescription("0/5000");
    expect(area).toHaveAttribute("maxlength", "5000");
  });

  it("RF-14: el contador sigue lo que se escribe", async () => {
    render(<AreaControlada etiqueta="Descripción" contador maxLength={5000} />);
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Descripción" }), "No imprime.");
    expect(screen.getByText("11/5000")).toBeInTheDocument();
  });

  it("el contador cuenta puntos de código, como el servidor", () => {
    render(<AreaControlada etiqueta="Descripción" contador maxLength={5000} inicial="😀😀 ok" />);
    expect(screen.getByText("5/5000")).toBeInTheDocument();
  });

  it("el contador marca cuando se pasa del máximo", () => {
    const { rerender } = render(<AreaTexto etiqueta="Comentario" contador maxLength={10} value={"a".repeat(10)} readOnly />);
    expect(screen.getByText("10/10")).not.toHaveAttribute("data-excedido");
    rerender(<AreaTexto etiqueta="Comentario" contador maxLength={10} value={"a".repeat(11)} readOnly />);
    expect(screen.getByText("11/10")).toHaveAttribute("data-excedido", "true");
  });

  it("sin maxLength no hay contador", () => {
    render(<AreaControlada etiqueta="Descripción" contador />);
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Descripción" })).not.toHaveAttribute("aria-describedby");
  });

  it("RF-15: el error va debajo con aria-invalid y aria-describedby, junto al contador", () => {
    render(
      <AreaControlada
        etiqueta="Descripción"
        contador
        maxLength={5000}
        error="Contá el problema en al menos 10 caracteres."
      />,
    );
    const area = screen.getByRole("textbox", { name: "Descripción" });
    const error = screen.getByText("Contá el problema en al menos 10 caracteres.");
    const contador = screen.getByText("0/5000");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAttribute("aria-describedby", `${error.id} ${contador.id}`);
    expect(area).toHaveAccessibleDescription("Contá el problema en al menos 10 caracteres. 0/5000");
    expect(area.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("RF-15: el error se va cuando ya no hay", () => {
    const { rerender } = render(<AreaTexto etiqueta="Descripción" error="Contá el problema en al menos 10 caracteres." />);
    rerender(<AreaTexto etiqueta="Descripción" error={null} />);
    const area = screen.getByRole("textbox", { name: "Descripción" });
    expect(area).not.toHaveAttribute("aria-invalid");
    expect(area).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Contá el problema en al menos 10 caracteres.")).not.toBeInTheDocument();
  });

  it("RF-21: con la etiqueta oculta conserva el nombre accesible", () => {
    render(<AreaControlada etiqueta="Comentario" etiquetaOculta maxLength={2000} />);
    expect(screen.getByRole("textbox", { name: "Comentario" })).toHaveAttribute("maxlength", "2000");
    expect(screen.getByText("Comentario")).toHaveAttribute("data-oculta", "true");
  });

  it("acepta otras filas y pasa la referencia al <textarea>", () => {
    const referencia = createRef<HTMLTextAreaElement>();
    render(<AreaTexto ref={referencia} etiqueta="Comentario" rows={3} />);
    const area = screen.getByRole("textbox", { name: "Comentario" });
    expect(area).toHaveAttribute("rows", "3");
    expect(referencia.current).toBe(area);
    act(() => referencia.current?.focus());
    expect(area).toHaveFocus();
  });
});
