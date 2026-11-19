import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type FormEvent } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Boton, EnlaceBoton, type VarianteBoton } from "./Boton";
import css from "./Boton.module.css?raw";

function FormularioIngreso({ cargando, alEnviar }: { cargando: boolean; alEnviar: () => void }) {
  return (
    <form
      onSubmit={(evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        alEnviar();
      }}
    >
      <Boton type="submit" variante="primario" anchoCompleto cargando={cargando} textoCargando="Iniciando sesión…">
        Iniciar sesión
      </Boton>
    </form>
  );
}

describe("Boton", () => {
  it("es un botón común (type=button) con la variante en data-variante", async () => {
    const alTocar = vi.fn();
    render(
      <Boton variante="primario" onClick={alTocar}>
        Aceptar
      </Boton>,
    );
    const boton = screen.getByRole("button", { name: "Aceptar" });
    expect(boton).toHaveAttribute("type", "button");
    expect(boton).toHaveAttribute("data-variante", "primario");
    expect(boton).toBeEnabled();
    await userEvent.setup().click(boton);
    expect(alTocar).toHaveBeenCalledTimes(1);
  });

  it("anchoCompleto se marca con data-ancho", () => {
    render(<FormularioIngreso cargando={false} alEnviar={() => undefined} />);
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toHaveAttribute("data-ancho", "completo");
  });

  it("RF-27: con cargando muestra 'Iniciando sesión…', queda deshabilitado y no envía", async () => {
    const alEnviar = vi.fn();
    render(<FormularioIngreso cargando alEnviar={alEnviar} />);
    const boton = screen.getByRole("button", { name: "Iniciando sesión…" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("data-cargando", "true");
    expect(screen.queryByText("Iniciar sesión")).not.toBeInTheDocument();
    await userEvent.setup().click(boton);
    expect(alEnviar).not.toHaveBeenCalled();
  });

  it("RF-27: al terminar de cargar vuelve 'Iniciar sesión' y se puede enviar de nuevo", async () => {
    const alEnviar = vi.fn();
    const { rerender } = render(<FormularioIngreso cargando alEnviar={alEnviar} />);
    rerender(<FormularioIngreso cargando={false} alEnviar={alEnviar} />);
    const boton = screen.getByRole("button", { name: "Iniciar sesión" });
    expect(boton).toBeEnabled();
    expect(boton).not.toHaveAttribute("data-cargando");
    await userEvent.setup().click(boton);
    expect(alEnviar).toHaveBeenCalledTimes(1);
  });

  it("sin variante es primario", () => {
    render(<Boton>Crear</Boton>);
    expect(screen.getByRole("button", { name: "Crear" })).toHaveAttribute("data-variante", "primario");
  });

  it.each<[VarianteBoton, string, RegExp]>([
    ["primario", "Crear", /background:\s*var\(--tq-acento\);[^}]*color:\s*#ffffff;/],
    ["secundario", "Cancelar", /background:\s*var\(--tq-superficie-2\);[^}]*color:\s*var\(--tq-texto\);/],
    ["simple", "Limpiar filtros", /background:\s*transparent;[^}]*color:\s*var\(--tq-acento\);/],
    ["peligro", "Cerrar ticket", /background:\s*var\(--tq-superficie-2\);[^}]*color:\s*var\(--tq-peligro\);/],
  ])("RF-10 y RF-25: la variante %s se marca en data-variante y tiene sus colores", (variante, texto, colores) => {
    const alTocar = vi.fn();
    render(
      <Boton variante={variante} onClick={alTocar}>
        {texto}
      </Boton>,
    );
    const boton = screen.getByRole("button", { name: texto });
    expect(boton).toHaveAttribute("data-variante", variante);
    boton.click();
    expect(alTocar).toHaveBeenCalledTimes(1);
    const regla = new RegExp(String.raw`\.boton\[data-variante="${variante}"\]\s*\{([^}]*)\}`).exec(css);
    expect(regla?.[1]).toMatch(colores);
  });

  it("acepta un ícono decorativo al lado del texto", () => {
    render(
      <Boton>
        <svg aria-hidden="true" />
        Nuevo ticket
      </Boton>,
    );
    expect(screen.getByRole("button", { name: "Nuevo ticket" })).toBeInTheDocument();
  });

  it("pasa la referencia al <button>, para poder darle el foco", () => {
    const referencia = createRef<HTMLButtonElement>();
    render(
      <Boton ref={referencia} variante="primario">
        Aceptar
      </Boton>,
    );
    expect(referencia.current).toBe(screen.getByRole("button", { name: "Aceptar" }));
  });
});

describe("EnlaceBoton", () => {
  it("RF-24 y RF-35: es un enlace con forma de botón primario", () => {
    render(
      <MemoryRouter>
        <EnlaceBoton to="/bandeja" variante="primario">
          Volver a Tickets
        </EnlaceBoton>
      </MemoryRouter>,
    );
    const enlace = screen.getByRole("link", { name: "Volver a Tickets" });
    expect(enlace).toHaveAttribute("href", "/bandeja");
    expect(enlace).toHaveAttribute("data-variante", "primario");
  });

  it.each<VarianteBoton>(["secundario", "simple", "peligro"])("acepta la variante %s", (variante) => {
    render(
      <MemoryRouter>
        <EnlaceBoton to="/bandeja" variante={variante}>
          Volver a Tickets
        </EnlaceBoton>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Volver a Tickets" })).toHaveAttribute("data-variante", variante);
  });
});
