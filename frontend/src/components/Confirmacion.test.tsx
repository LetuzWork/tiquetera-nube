import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Confirmacion } from "./Confirmacion";

const TITULO = "La jornada terminó";
const TEXTO = "El acceso está disponible de lunes a viernes, de 08:00 a 18:00. Tu sesión se cerró.";

function montar(alAceptar: () => void = vi.fn()) {
  const resultado = render(
    <>
      <button type="button">Antes</button>
      <Confirmacion titulo={TITULO} texto={TEXTO} alAceptar={alAceptar} />
      <button type="button">Después</button>
    </>,
  );
  return { ...resultado, persona: userEvent.setup(), aceptar: screen.getByRole("button", { name: "Aceptar" }) };
}

describe("Confirmacion", () => {
  it("RF-22: es un alertdialog modal con título y texto, en un portal a document.body", () => {
    const { container, unmount } = montar();
    const dialogo = screen.getByRole("alertdialog", { name: TITULO });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleDescription(TEXTO);
    expect(container).not.toContainElement(dialogo);
    expect(document.body).toContainElement(dialogo);
    unmount();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("RF-22: la variante de la sesión vencida", () => {
    render(<Confirmacion titulo="Tu sesión venció" texto="Iniciá sesión de nuevo para seguir." alAceptar={vi.fn()} />);
    const dialogo = screen.getByRole("alertdialog", { name: "Tu sesión venció" });
    expect(dialogo).toHaveAccessibleDescription("Iniciá sesión de nuevo para seguir.");
  });

  it("RF-22: no tiene opción de cancelar: su único botón es 'Aceptar'", () => {
    montar();
    const dialogo = screen.getByRole("alertdialog", { name: TITULO });
    expect(dialogo).toContainElement(screen.getByRole("button", { name: "Aceptar" }));
    expect(within(dialogo).getAllByRole("button").map((boton) => boton.textContent)).toEqual(["Aceptar"]);
  });

  it("RF-22 y RNF-6: el foco empieza en 'Aceptar'", () => {
    const { aceptar } = montar();
    expect(aceptar).toHaveFocus();
  });

  it("RF-22: Esc no lo cierra", async () => {
    const alAceptar = vi.fn();
    const { persona, aceptar } = montar(alAceptar);
    await persona.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: TITULO })).toBeInTheDocument();
    expect(alAceptar).not.toHaveBeenCalled();
    expect(aceptar).toHaveFocus();
  });

  it("RF-22 y RNF-6: Tab y Shift+Tab no sacan el foco del diálogo", async () => {
    const { persona, aceptar } = montar();
    await persona.tab();
    expect(aceptar).toHaveFocus();
    await persona.tab({ shift: true });
    expect(aceptar).toHaveFocus();
    await persona.tab();
    await persona.tab();
    expect(aceptar).toHaveFocus();
  });

  it("RF-22: un clic dentro del diálogo, fuera de 'Aceptar', no le saca el foco", async () => {
    const { persona, aceptar } = montar();
    await persona.click(screen.getByText(TITULO));
    expect(aceptar).toHaveFocus();
  });

  it("RF-22: 'Aceptar' llama a alAceptar, con clic o con Enter", async () => {
    const alAceptar = vi.fn();
    const { persona, aceptar } = montar(alAceptar);
    await persona.keyboard("{Enter}");
    expect(alAceptar).toHaveBeenCalledTimes(1);
    await persona.click(aceptar);
    expect(alAceptar).toHaveBeenCalledTimes(2);
  });
});

describe("Confirmacion con alCancelar (RF-25)", () => {
  const TITULO_CIERRE = "¿Cerrar TQ-000045?";
  const TEXTO_CIERRE = "Solo un administrador puede reabrirlo.";

  function montarCierre() {
    const alAceptar = vi.fn();
    const alCancelar = vi.fn();
    render(
      <>
        <button type="button">Antes</button>
        <Confirmacion
          titulo={TITULO_CIERRE}
          texto={TEXTO_CIERRE}
          textoAceptar="Cerrar ticket"
          varianteAceptar="peligro"
          alAceptar={alAceptar}
          alCancelar={alCancelar}
        />
        <button type="button">Después</button>
      </>,
    );
    return {
      alAceptar,
      alCancelar,
      persona: userEvent.setup(),
      cancelar: screen.getByRole("button", { name: "Cancelar" }),
      cerrar: screen.getByRole("button", { name: "Cerrar ticket" }),
    };
  }

  function SelectorDeEstado() {
    const [confirmando, setConfirmando] = useState(false);
    const [estado, setEstado] = useState("RESUELTO");
    return (
      <>
        <label>
          Estado
          <select
            value={estado}
            onChange={(evento) => {
              if (evento.target.value === "CERRADO") setConfirmando(true);
              else setEstado(evento.target.value);
            }}
          >
            <option value="RESUELTO">Resuelto</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </label>
        {confirmando && (
          <Confirmacion
            titulo={TITULO_CIERRE}
            texto={TEXTO_CIERRE}
            textoAceptar="Cerrar ticket"
            alAceptar={() => {
              setEstado("CERRADO");
              setConfirmando(false);
            }}
            alCancelar={() => setConfirmando(false)}
          />
        )}
      </>
    );
  }

  it("es un alertdialog modal con '¿Cerrar TQ-000045?' y 'Solo un administrador puede reabrirlo.'", () => {
    montarCierre();
    const dialogo = screen.getByRole("alertdialog", { name: TITULO_CIERRE });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleDescription(TEXTO_CIERRE);
  });

  it("tiene 'Cancelar' y 'Cerrar ticket', en ese orden, con 'Cerrar ticket' en peligro", () => {
    const { cancelar, cerrar } = montarCierre();
    const dialogo = screen.getByRole("alertdialog", { name: TITULO_CIERRE });
    expect(within(dialogo).getAllByRole("button").map((boton) => boton.textContent)).toEqual([
      "Cancelar",
      "Cerrar ticket",
    ]);
    expect(cancelar).toHaveAttribute("data-variante", "secundario");
    expect(cerrar).toHaveAttribute("data-variante", "peligro");
  });

  it("RNF-3: el foco empieza en 'Cancelar'", () => {
    const { cancelar } = montarCierre();
    expect(cancelar).toHaveFocus();
  });

  it("Esc cancela y no acepta", async () => {
    const { persona, alAceptar, alCancelar } = montarCierre();
    await persona.keyboard("{Escape}");
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alAceptar).not.toHaveBeenCalled();
  });

  it("Enter con el foco inicial cancela", async () => {
    const { persona, alAceptar, alCancelar } = montarCierre();
    await persona.keyboard("{Enter}");
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alAceptar).not.toHaveBeenCalled();
  });

  it("RNF-3: Tab y Shift+Tab circulan entre los dos botones sin salir del diálogo", async () => {
    const { persona, cancelar, cerrar } = montarCierre();
    await persona.tab();
    expect(cerrar).toHaveFocus();
    await persona.tab();
    expect(cancelar).toHaveFocus();
    await persona.tab({ shift: true });
    expect(cerrar).toHaveFocus();
    await persona.tab({ shift: true });
    expect(cancelar).toHaveFocus();
  });

  it("'Cerrar ticket' acepta y 'Cancelar' cancela, con clic", async () => {
    const { persona, cancelar, cerrar, alAceptar, alCancelar } = montarCierre();
    await persona.click(cerrar);
    expect(alAceptar).toHaveBeenCalledTimes(1);
    await persona.click(cancelar);
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alAceptar).toHaveBeenCalledTimes(1);
  });

  it("un clic dentro del diálogo, fuera de los botones, no les saca el foco", async () => {
    const { persona, cancelar } = montarCierre();
    await persona.click(screen.getByText(TEXTO_CIERRE));
    expect(cancelar).toHaveFocus();
  });

  it("al cancelar, el diálogo se va, el estado queda como estaba y el foco vuelve al selector", async () => {
    render(<SelectorDeEstado />);
    const persona = userEvent.setup();
    const selector = screen.getByRole("combobox", { name: "Estado" });
    await persona.selectOptions(selector, "CERRADO");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await persona.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(selector).toHaveValue("RESUELTO");
    expect(selector).toHaveFocus();
  });

  it("al aceptar, el foco también vuelve al selector", async () => {
    render(<SelectorDeEstado />);
    const persona = userEvent.setup();
    const selector = screen.getByRole("combobox", { name: "Estado" });
    act(() => selector.focus());
    await persona.selectOptions(selector, "CERRADO");
    await persona.click(screen.getByRole("button", { name: "Cerrar ticket" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(selector).toHaveValue("CERRADO");
    expect(selector).toHaveFocus();
  });

  it("sin textoAceptar ni variante, el botón dice 'Aceptar' y es primario", () => {
    render(<Confirmacion titulo={TITULO} texto={TEXTO} alAceptar={vi.fn()} alCancelar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Aceptar" })).toHaveAttribute("data-variante", "primario");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });
});
