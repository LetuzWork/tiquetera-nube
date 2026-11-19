import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";
import css from "./Avatar.module.css?raw";

describe("Avatar", () => {
  it.each([
    ["Omar Operador", "OO"],
    ["María José de la Fuente", "MF"],
    ["u.admin", "UA"],
  ])("RF-19: %s → %s", (nombre, esperadas) => {
    const { container } = render(<Avatar nombre={nombre} />);
    expect(container.textContent).toBe(esperadas);
  });

  it("RF-19: es decorativo, porque el nombre ya se lee al lado", () => {
    render(<Avatar nombre="Omar Operador" />);
    expect(screen.getByText("OO")).toHaveAttribute("aria-hidden", "true");
  });

  it("sin variante es la del cielo", () => {
    render(<Avatar nombre="Omar Operador" />);
    expect(screen.getByText("OO")).toHaveAttribute("data-variante", "cielo");
  });

  it("RF-4 y RF-20: la variante clara, para el vidrio, va en acento sobre acento suave", () => {
    render(<Avatar nombre="u.operador" variante="claro" />);
    const avatar = screen.getByText("UO");
    expect(avatar).toHaveAttribute("data-variante", "claro");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    const regla = /\.avatar\[data-variante="claro"\]\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(regla).toMatch(/var\(--tq-acento-suave\)/);
    expect(regla).toMatch(/color:\s*var\(--tq-acento\);/);
  });
});
