import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GrupoCampos } from "./GrupoCampos";

function Grupo({ sacudidas }: { sacudidas?: number }) {
  return (
    <GrupoCampos leyenda="Cuenta de dominio" leyendaOculta sacudidas={sacudidas}>
      <input aria-label="Usuario" />
      <input aria-label="Contraseña" type="password" />
    </GrupoCampos>
  );
}

describe("GrupoCampos", () => {
  it("es un grupo con la leyenda como nombre y los campos adentro", () => {
    render(<Grupo />);
    const grupo = screen.getByRole("group", { name: "Cuenta de dominio" });
    expect(grupo).toContainElement(screen.getByRole("textbox", { name: "Usuario" }));
    expect(grupo).toContainElement(screen.getByLabelText("Contraseña"));
  });

  it("con leyendaOculta, la leyenda sigue nombrando al grupo y se marca con data-oculta", () => {
    render(<Grupo />);
    expect(screen.getByText("Cuenta de dominio")).toHaveAttribute("data-oculta", "true");
    expect(screen.getByRole("group", { name: "Cuenta de dominio" })).toBeInTheDocument();
  });

  it("sin leyendaOculta, la leyenda se ve", () => {
    render(
      <GrupoCampos leyenda="Cuenta de dominio">
        <input aria-label="Usuario" />
      </GrupoCampos>,
    );
    expect(screen.getByText("Cuenta de dominio")).not.toHaveAttribute("data-oculta");
  });

  it("RF-28: sin intentos fallidos no se sacude", () => {
    render(<Grupo />);
    expect(screen.getByRole("group", { name: "Cuenta de dominio" })).toHaveAttribute("data-sacudir", "false");
  });

  it("RF-28: se sacude con el primer rechazo y vuelve a sacudirse con cada nuevo rechazo", () => {
    const { rerender } = render(<Grupo sacudidas={0} />);
    const grupo = screen.getByRole("group", { name: "Cuenta de dominio" });

    rerender(<Grupo sacudidas={1} />);
    expect(grupo).toHaveAttribute("data-sacudir", "true");
    const primera = grupo.getAttribute("data-vuelta");
    expect(primera).not.toBeNull();

    rerender(<Grupo sacudidas={2} />);
    expect(grupo).toHaveAttribute("data-sacudir", "true");
    const segunda = grupo.getAttribute("data-vuelta");
    expect(segunda).not.toBeNull();
    expect(segunda).not.toBe(primera);

    rerender(<Grupo sacudidas={3} />);
    expect(grupo).toHaveAttribute("data-vuelta", primera);
  });

  it("RF-28: sacudirse no vuelve a montar los campos: quedan el texto y el foco", async () => {
    const { rerender } = render(<Grupo sacudidas={0} />);
    const contrasena = screen.getByLabelText("Contraseña");
    await userEvent.setup().type(contrasena, "secreta");
    rerender(<Grupo sacudidas={1} />);
    expect(screen.getByLabelText("Contraseña")).toBe(contrasena);
    expect(contrasena).toHaveValue("secreta");
    expect(contrasena).toHaveFocus();
  });
});
