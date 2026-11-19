import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { Campo } from "./Campo";

describe("Campo", () => {
  it("asocia la etiqueta y pasa autoComplete", () => {
    render(<Campo etiqueta="Usuario" autoComplete="username" />);
    const entrada = screen.getByRole("textbox", { name: "Usuario" });
    expect(entrada).toHaveAttribute("autocomplete", "username");
    expect(entrada).not.toHaveAttribute("aria-invalid");
    expect(entrada).not.toHaveAttribute("aria-describedby");
  });

  it("RF-26: muestra el error debajo, con aria-invalid y aria-describedby", () => {
    render(<Campo etiqueta="Usuario" error="Escribí solo tu usuario, sin el dominio." />);
    const entrada = screen.getByRole("textbox", { name: "Usuario" });
    const error = screen.getByText("Escribí solo tu usuario, sin el dominio.");
    expect(entrada).toHaveAttribute("aria-invalid", "true");
    expect(entrada).toHaveAttribute("aria-describedby", error.id);
    expect(entrada).toHaveAccessibleDescription("Escribí solo tu usuario, sin el dominio.");
    expect(entrada.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("RF-26: el error se va cuando ya no hay", () => {
    const { rerender } = render(
      <Campo etiqueta="Usuario" error="Usuario inválido: solo letras sin tilde, números, punto, guion y guion bajo." />,
    );
    rerender(<Campo etiqueta="Usuario" error={null} />);
    const entrada = screen.getByRole("textbox", { name: "Usuario" });
    expect(entrada).not.toHaveAttribute("aria-invalid");
    expect(entrada).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByText("Usuario inválido: solo letras sin tilde, números, punto, guion y guion bajo."),
    ).not.toBeInTheDocument();
  });

  it("RF-26: la contraseña acepta type, autoComplete y maxLength, y tiene su propio error", () => {
    render(
      <>
        <Campo etiqueta="Usuario" error="Escribí solo tu usuario, sin el dominio." />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          error="Ingresá la contraseña."
        />
      </>,
    );
    const contrasena = screen.getByLabelText("Contraseña");
    expect(contrasena).toHaveAttribute("type", "password");
    expect(contrasena).toHaveAttribute("autocomplete", "current-password");
    expect(contrasena).toHaveAttribute("maxlength", "256");
    expect(contrasena).toHaveAccessibleDescription("Ingresá la contraseña.");
    expect(screen.getByRole("textbox", { name: "Usuario" })).toHaveAccessibleDescription(
      "Escribí solo tu usuario, sin el dominio.",
    );
  });

  it("pasa la referencia al <input>, para poder darle el foco", () => {
    const referencia = createRef<HTMLInputElement>();
    render(<Campo ref={referencia} etiqueta="Contraseña" type="password" />);
    act(() => referencia.current?.focus());
    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
  });

  it("se escribe como en cualquier campo", async () => {
    render(<Campo etiqueta="Usuario" />);
    const entrada = screen.getByRole("textbox", { name: "Usuario" });
    await userEvent.setup().type(entrada, "u.operador");
    expect(entrada).toHaveValue("u.operador");
  });

  describe("RF-14: contador", () => {
    function TituloControlado({ inicial = "", error }: { inicial?: string; error?: string }) {
      const [valor, setValor] = useState(inicial);
      return (
        <Campo
          etiqueta="Título"
          contador
          maxLength={120}
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          error={error}
        />
      );
    }

    it("con contador y maxLength muestra '12/120' y lo usa como descripción", () => {
      render(<TituloControlado inicial="Sin internet" />);
      const entrada = screen.getByRole("textbox", { name: "Título" });
      const contador = screen.getByText("12/120");
      expect(entrada).toHaveAttribute("aria-describedby", contador.id);
      expect(entrada).toHaveAccessibleDescription("12/120");
    });

    it("sigue lo que se escribe", async () => {
      render(<TituloControlado />);
      expect(screen.getByText("0/120")).toBeInTheDocument();
      await userEvent.setup().type(screen.getByRole("textbox", { name: "Título" }), "Red caída");
      expect(screen.getByText("9/120")).toBeInTheDocument();
    });

    it("RF-15: con error, la descripción lleva el error y el contador", () => {
      render(<TituloControlado inicial="Red" error="El título necesita al menos 5 caracteres." />);
      const entrada = screen.getByRole("textbox", { name: "Título" });
      const error = screen.getByText("El título necesita al menos 5 caracteres.");
      const contador = screen.getByText("3/120");
      expect(entrada).toHaveAttribute("aria-invalid", "true");
      expect(entrada).toHaveAttribute("aria-describedby", `${error.id} ${contador.id}`);
      expect(entrada).toHaveAccessibleDescription("El título necesita al menos 5 caracteres. 3/120");
    });

    it("marca cuando se pasa del máximo", () => {
      render(<Campo etiqueta="Título" contador maxLength={5} value="abcdef" readOnly />);
      expect(screen.getByText("6/5")).toHaveAttribute("data-excedido", "true");
    });

    it("sin contador, o sin maxLength, no hay contador", () => {
      render(
        <>
          <Campo etiqueta="Usuario" maxLength={256} value="u.operador" readOnly />
          <Campo etiqueta="Título" contador value="Sin internet" readOnly />
        </>,
      );
      expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Usuario" })).not.toHaveAttribute("aria-describedby");
      expect(screen.getByRole("textbox", { name: "Título" })).not.toHaveAttribute("aria-describedby");
    });
  });
});
