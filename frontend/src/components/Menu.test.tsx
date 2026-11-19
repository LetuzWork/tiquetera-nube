import { act, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import { Menu } from "./Menu";
import css from "./Menu.module.css?raw";

const NOMBRE = "Cuenta de Omar Operador";
const DESCRIPCION = "Sesión hasta las 10:00";

function montar() {
  const elegir = { uno: vi.fn(), dos: vi.fn(), salir: vi.fn() };
  render(
    <>
      <button type="button">Antes</button>
      <Menu
        etiqueta={NOMBRE}
        contenido={<span>Omar Operador</span>}
        descripcion={DESCRIPCION}
        items={[
          { texto: "Opción uno", alElegir: elegir.uno },
          { texto: "Opción dos", alElegir: elegir.dos },
          { texto: "Cerrar sesión", alElegir: elegir.salir },
        ]}
      />
      <button type="button">Después</button>
    </>,
  );
  const boton = screen.getByRole("button", { name: NOMBRE });
  return { elegir, boton, persona: userEvent.setup() };
}

function item(nombre: string): HTMLElement {
  return screen.getByRole("menuitem", { name: nombre });
}

function nadaElegido(elegir: { uno: Mock; dos: Mock; salir: Mock }) {
  for (const accion of Object.values(elegir)) expect(accion).not.toHaveBeenCalled();
}

async function abrirConTeclado(boton: HTMLElement, persona: UserEvent, tecla: string) {
  act(() => boton.focus());
  await persona.keyboard(tecla);
}

describe("Menu", () => {
  it("RF-19: cerrado, es un botón con nombre accesible que anuncia un menú", () => {
    const { boton } = montar();
    expect(boton).toHaveAttribute("aria-haspopup", "menu");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveTextContent("Omar Operador");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("RF-19: Enter abre el menú con el foco en el primer ítem", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    const menu = screen.getByRole("menu", { name: NOMBRE });
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(boton).toHaveAttribute("aria-controls", menu.id);
    expect(item("Opción uno")).toHaveFocus();
    nadaElegido(elegir);
  });

  it("RF-19: Espacio abre el menú con el foco en el primer ítem", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, " ");
    expect(screen.getByRole("menu", { name: NOMBRE })).toBeInTheDocument();
    expect(item("Opción uno")).toHaveFocus();
    nadaElegido(elegir);
  });

  it("RF-19: ↓ abre en el primer ítem y ↑ en el último", async () => {
    const { boton, persona } = montar();
    await abrirConTeclado(boton, persona, "{ArrowDown}");
    expect(item("Opción uno")).toHaveFocus();
    await persona.keyboard("{Escape}");
    await persona.keyboard("{ArrowUp}");
    expect(item("Cerrar sesión")).toHaveFocus();
  });

  it("RF-19: ↓ y ↑ recorren los ítems y dan la vuelta; Inicio y Fin van a los extremos", async () => {
    const { boton, persona } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.keyboard("{ArrowDown}");
    expect(item("Opción dos")).toHaveFocus();
    await persona.keyboard("{ArrowDown}");
    expect(item("Cerrar sesión")).toHaveFocus();
    await persona.keyboard("{ArrowDown}");
    expect(item("Opción uno")).toHaveFocus();
    await persona.keyboard("{ArrowUp}");
    expect(item("Cerrar sesión")).toHaveFocus();
    await persona.keyboard("{Home}");
    expect(item("Opción uno")).toHaveFocus();
    await persona.keyboard("{End}");
    expect(item("Cerrar sesión")).toHaveFocus();
  });

  it("RF-19: Enter elige el ítem, cierra el menú y devuelve el foco al botón", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.keyboard("{End}");
    await persona.keyboard("{Enter}");
    expect(elegir.salir).toHaveBeenCalledTimes(1);
    expect(elegir.uno).not.toHaveBeenCalled();
    expect(elegir.dos).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveFocus();
  });

  it("Espacio también elige el ítem", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.keyboard("{ArrowDown}");
    await persona.keyboard(" ");
    expect(elegir.dos).toHaveBeenCalledTimes(1);
    expect(elegir.uno).not.toHaveBeenCalled();
    expect(elegir.salir).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it("RF-19 y RNF-6: Esc cierra sin elegir y devuelve el foco al botón", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.keyboard("{ArrowDown}");
    await persona.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveFocus();
    nadaElegido(elegir);
  });

  it("Tab cierra el menú sin elegir y el foco sigue al próximo elemento", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Después" })).toHaveFocus();
    nadaElegido(elegir);
  });

  it("Shift+Tab cierra el menú y el foco vuelve al botón", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.tab({ shift: true });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    nadaElegido(elegir);
  });

  it("un clic afuera cierra el menú sin elegir", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.click(screen.getByRole("button", { name: "Antes" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Antes" })).toHaveFocus();
    nadaElegido(elegir);
  });

  it("con el mouse: un clic en el botón abre, otro cierra, y un clic en un ítem lo elige", async () => {
    const { boton, persona, elegir } = montar();
    await persona.click(boton);
    expect(screen.getByRole("menu", { name: NOMBRE })).toBeInTheDocument();
    await persona.click(boton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await persona.click(boton);
    await persona.click(item("Opción uno"));
    expect(elegir.uno).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it("un clic en la línea descriptiva no cierra el menú", async () => {
    const { boton, persona, elegir } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    await persona.click(screen.getByText(DESCRIPCION));
    expect(screen.getByRole("menu", { name: NOMBRE })).toBeInTheDocument();
    nadaElegido(elegir);
  });

  it("RF-19: 'Sesión hasta las 10:00' describe al menú y no es un ítem", async () => {
    const { boton, persona } = montar();
    await abrirConTeclado(boton, persona, "{Enter}");
    const menu = screen.getByRole("menu", { name: NOMBRE });
    expect(menu).toHaveAccessibleDescription(DESCRIPCION);
    expect(screen.getAllByRole("menuitem").map((elemento) => elemento.textContent)).toEqual([
      "Opción uno",
      "Opción dos",
      "Cerrar sesión",
    ]);
    expect(menu).not.toContainElement(screen.getByText(DESCRIPCION));
  });

  describe("variante", () => {
    it("sin variante es la del cielo", () => {
      const { boton } = montar();
      expect(boton).toHaveAttribute("data-variante", "cielo");
    });

    it("RF-31: la variante común, para 'Exportar' en el vidrio, se comporta igual", async () => {
      const elegir = vi.fn();
      render(
        <Menu
          etiqueta="Exportar"
          contenido={<span>Exportar</span>}
          variante="comun"
          items={[
            { texto: "Tickets (CSV)", alElegir: elegir },
            { texto: "Historial (CSV)", alElegir: () => undefined },
          ]}
        />,
      );
      const boton = screen.getByRole("button", { name: "Exportar" });
      expect(boton).toHaveAttribute("data-variante", "comun");
      const persona = userEvent.setup();
      await abrirConTeclado(boton, persona, "{Enter}");
      expect(screen.getByRole("menu", { name: "Exportar" })).toBeInTheDocument();
      expect(item("Tickets (CSV)")).toHaveFocus();
      await persona.keyboard("{Enter}");
      expect(elegir).toHaveBeenCalledTimes(1);
      expect(boton).toHaveFocus();
    });

    it("la variante común se pinta como un botón secundario", () => {
      const regla = /\.boton\[data-variante="comun"\]\s*\{([^}]*)\}/.exec(css)?.[1];
      expect(regla).toMatch(/background:\s*var\(--tq-superficie-2\);/);
      expect(regla).toMatch(/color:\s*var\(--tq-texto\);/);
    });
  });
});
