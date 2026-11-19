import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Aviso } from "./Aviso";
import css from "./Aviso.module.css?raw";

const TEXTO = "Tu sesión vence a las 10:00.";

function reglaDe(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regla = new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`).exec(css);
  if (!regla?.[1]) throw new Error(`No está la regla ${selector}`);
  return regla[1];
}

function pildoraDe(region: HTMLElement): Element {
  const pildora = region.closest("[data-abierto]");
  if (!pildora) throw new Error("El aviso no tiene data-abierto");
  return pildora;
}

function AvisoQueSeCierra() {
  const [visible, setVisible] = useState(true);
  return visible ? <Aviso alCerrar={() => setVisible(false)}>{TEXTO}</Aviso> : null;
}

function Pantalla({ conAviso }: { conAviso: boolean }) {
  return (
    <>
      <button type="button">Seguir trabajando</button>
      {conAviso && <Aviso alCerrar={() => undefined}>{TEXTO}</Aviso>}
    </>
  );
}

describe("Aviso", () => {
  it("RF-21: anuncia el texto con role=status", () => {
    render(<Aviso alCerrar={() => undefined}>{TEXTO}</Aviso>);
    expect(screen.getByRole("status")).toHaveTextContent(TEXTO);
  });

  it("RF-21: queda visible hasta que se toca 'Cerrar aviso'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const persona = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    render(<AvisoQueSeCierra />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(TEXTO);
    await persona.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument();
  });

  it("RF-21: 'Cerrar aviso' llama a alCerrar una vez", async () => {
    const alCerrar = vi.fn();
    render(<Aviso alCerrar={alCerrar}>{TEXTO}</Aviso>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("el botón de cerrar es de solo ícono, con el ícono decorativo", () => {
    render(<Aviso alCerrar={() => undefined}>{TEXTO}</Aviso>);
    const boton = screen.getByRole("button", { name: "Cerrar aviso" });
    expect(boton).toHaveAttribute("type", "button");
    expect(boton.textContent).toBe("");
    const icono = boton.querySelector('[aria-hidden="true"]');
    expect(icono?.tagName.toLowerCase()).toBe("svg");
    expect(icono).toHaveAttribute("stroke-width", "1.75");
  });

  it("RF-21: aparecer no mueve el foco", () => {
    const { rerender } = render(<Pantalla conAviso={false} />);
    const boton = screen.getByRole("button", { name: "Seguir trabajando" });
    act(() => boton.focus());
    rerender(<Pantalla conAviso />);
    expect(screen.getByRole("status")).toHaveTextContent(TEXTO);
    expect(boton).toHaveFocus();
  });

  describe("región siempre montada (para que los lectores anuncien el texto)", () => {
    it("cerrado, deja la región vacía en la página, sin píldora ni botón", () => {
      render(<Aviso abierto={false} alCerrar={() => undefined} />);
      const region = screen.getByRole("status");
      expect(region).toBeEmptyDOMElement();
      expect(pildoraDe(region)).toHaveAttribute("data-abierto", "false");
      expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
    });

    it("al abrirse, el texto entra en la misma región, y al cerrarse sale de ella", () => {
      const { rerender } = render(<Aviso abierto={false} alCerrar={() => undefined} />);
      const region = screen.getByRole("status");
      rerender(
        <Aviso abierto alCerrar={() => undefined}>
          {TEXTO}
        </Aviso>,
      );
      expect(screen.getByRole("status")).toBe(region);
      expect(region).toHaveTextContent(TEXTO);
      expect(pildoraDe(region)).toHaveAttribute("data-abierto", "true");
      expect(screen.getByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
      rerender(
        <Aviso abierto={false} alCerrar={() => undefined}>
          {TEXTO}
        </Aviso>,
      );
      expect(screen.getByRole("status")).toBe(region);
      expect(region).toBeEmptyDOMElement();
      expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
    });

    it("sin abierto, se abre como antes", () => {
      render(<Aviso alCerrar={() => undefined}>{TEXTO}</Aviso>);
      expect(pildoraDe(screen.getByRole("status"))).toHaveAttribute("data-abierto", "true");
    });

    it("cerrado, la región queda fuera de la vista con el patrón de solo lectores", () => {
      const cerrado = reglaDe('.aviso[data-abierto="false"]');
      expect(cerrado).toMatch(/width:\s*1px;/);
      expect(cerrado).toMatch(/height:\s*1px;/);
      expect(cerrado).toMatch(/overflow:\s*hidden;/);
      expect(cerrado).toMatch(/clip-path:\s*inset\(50%\);/);
      expect(cerrado).toMatch(/box-shadow:\s*none;/);
    });
  });
});
