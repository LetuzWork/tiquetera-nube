import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Buscador, ESPERA_BUSQUEDA_MS } from "./Buscador";

// Temporizadores falsos puros y fireEvent: con shouldAdvanceTime el reloj real se suma y el borde de 299 ms falla.
beforeEach(() => {
  vi.useFakeTimers();
});

function montar(valor = "", props: { atajo?: boolean } = {}) {
  const alBuscar = vi.fn<(texto: string) => void>();
  const resultado = render(
    <>
      <button type="button">Nuevo ticket</button>
      <Buscador valor={valor} alBuscar={alBuscar} {...props} />
    </>,
  );
  const entrada = screen.getByRole("searchbox", { name: "Buscar tickets" });
  const volverAMontar = (nuevo: string) =>
    resultado.rerender(
      <>
        <button type="button">Nuevo ticket</button>
        <Buscador valor={nuevo} alBuscar={alBuscar} {...props} />
      </>,
    );
  return { alBuscar, entrada, volverAMontar };
}

function escribir(entrada: HTMLElement, texto: string) {
  fireEvent.change(entrada, { target: { value: texto } });
}

function esperar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("Buscador", () => {
  it("RF-5: es un campo de búsqueda 'Buscar tickets' con la ayuda 'Buscar por número o título'", () => {
    const { entrada } = montar();
    expect(entrada).toHaveAttribute("type", "search");
    expect(entrada).toHaveAttribute("placeholder", "Buscar por número o título");
    expect(entrada).toHaveAttribute("aria-keyshortcuts", "/");
    expect(entrada).toHaveAttribute("maxlength", "100");
    expect(entrada).toHaveValue("");
  });

  it("muestra el valor que llega de la dirección", () => {
    const { entrada } = montar("impresora");
    expect(entrada).toHaveValue("impresora");
  });

  it("RF-5: consulta 300 ms después de la última tecla, no antes", () => {
    expect(ESPERA_BUSQUEDA_MS).toBe(300);
    const { entrada, alBuscar } = montar();
    escribir(entrada, "imp");
    expect(entrada).toHaveValue("imp");
    esperar(299);
    expect(alBuscar).not.toHaveBeenCalled();
    esperar(1);
    expect(alBuscar).toHaveBeenCalledTimes(1);
    expect(alBuscar).toHaveBeenCalledWith("imp");
  });

  it("RF-5: cada tecla reinicia la espera y solo se consulta lo último", () => {
    const { entrada, alBuscar } = montar();
    escribir(entrada, "i");
    esperar(200);
    escribir(entrada, "im");
    esperar(200);
    escribir(entrada, "imp");
    esperar(299);
    expect(alBuscar).not.toHaveBeenCalled();
    esperar(1);
    expect(alBuscar.mock.calls).toEqual([["imp"]]);
  });

  it("Enter consulta en el momento y no repite a los 300 ms", () => {
    const { entrada, alBuscar } = montar();
    escribir(entrada, "red");
    fireEvent.keyDown(entrada, { key: "Enter" });
    expect(alBuscar.mock.calls).toEqual([["red"]]);
    esperar(1000);
    expect(alBuscar).toHaveBeenCalledTimes(1);
  });

  it("RF-5: Esc borra la búsqueda y consulta vacío en el momento, sin la consulta pendiente", () => {
    const { entrada, alBuscar } = montar();
    escribir(entrada, "red");
    const evento = fireEvent.keyDown(entrada, { key: "Escape" });
    expect(evento).toBe(false);
    expect(entrada).toHaveValue("");
    expect(alBuscar.mock.calls).toEqual([[""]]);
    esperar(1000);
    expect(alBuscar.mock.calls).toEqual([[""]]);
  });

  it("Esc con el campo vacío no consulta", () => {
    const { entrada, alBuscar } = montar();
    fireEvent.keyDown(entrada, { key: "Escape" });
    esperar(1000);
    expect(alBuscar).not.toHaveBeenCalled();
  });

  it("'Borrar búsqueda' aparece con texto, borra, consulta vacío y devuelve el foco al campo", () => {
    const { entrada, alBuscar } = montar();
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).not.toBeInTheDocument();
    escribir(entrada, "red");
    const borrar = screen.getByRole("button", { name: "Borrar búsqueda" });
    act(() => borrar.focus());
    fireEvent.click(borrar);
    expect(entrada).toHaveValue("");
    expect(entrada).toHaveFocus();
    expect(alBuscar.mock.calls).toEqual([[""]]);
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).not.toBeInTheDocument();
    esperar(1000);
    expect(alBuscar).toHaveBeenCalledTimes(1);
  });

  describe("RF-5: el atajo '/'", () => {
    it("enfoca el campo cuando el foco está en la página", () => {
      const { entrada } = montar();
      const seguir = fireEvent.keyDown(document.body, { key: "/" });
      expect(entrada).toHaveFocus();
      expect(seguir).toBe(false);
    });

    it("enfoca el campo cuando el foco está en un botón", () => {
      const { entrada } = montar();
      const boton = screen.getByRole("button", { name: "Nuevo ticket" });
      act(() => boton.focus());
      fireEvent.keyDown(boton, { key: "/" });
      expect(entrada).toHaveFocus();
    });

    it.each([
      ["un campo", <input key="campo" aria-label="Otro campo" />],
      ["un área de texto", <textarea key="area" aria-label="Otro campo" />],
      [
        "un selector",
        <select key="selector" aria-label="Otro campo">
          <option>Uno</option>
        </select>,
      ],
      ["un editable", <div key="editable" aria-label="Otro campo" role="textbox" tabIndex={0} contentEditable suppressContentEditableWarning />],
    ])("no lo enfoca cuando el foco está en %s, y deja escribir la barra", (_, otro) => {
      const alBuscar = vi.fn();
      render(
        <>
          {otro}
          <Buscador valor="" alBuscar={alBuscar} />
        </>,
      );
      const campo = screen.getByLabelText("Otro campo");
      act(() => campo.focus());
      const seguir = fireEvent.keyDown(campo, { key: "/" });
      expect(campo).toHaveFocus();
      expect(seguir).toBe(true);
    });

    it("con Ctrl, Alt o ⌘ no hace nada", () => {
      const { entrada } = montar();
      fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
      fireEvent.keyDown(document.body, { key: "/", metaKey: true });
      fireEvent.keyDown(document.body, { key: "/", altKey: true });
      expect(entrada).not.toHaveFocus();
    });

    it("sin atajo, '/' no hace nada", () => {
      const { entrada } = montar("", { atajo: false });
      expect(entrada).not.toHaveAttribute("aria-keyshortcuts");
      fireEvent.keyDown(document.body, { key: "/" });
      expect(entrada).not.toHaveFocus();
    });

    it("se quita al desmontar", () => {
      const { unmount } = render(<Buscador valor="" alBuscar={() => undefined} />);
      unmount();
      expect(fireEvent.keyDown(document.body, { key: "/" })).toBe(true);
    });
  });

  describe("RF-8: el valor que llega de afuera", () => {
    it("un cambio desde afuera (volver, 'Limpiar filtros') pisa lo escrito y descarta lo pendiente", () => {
      const { entrada, alBuscar, volverAMontar } = montar("red");
      escribir(entrada, "redes");
      volverAMontar("");
      expect(entrada).toHaveValue("");
      esperar(1000);
      expect(alBuscar).not.toHaveBeenCalled();
    });

    it("el eco de su propia búsqueda no pisa lo que se sigue escribiendo", () => {
      const { entrada, alBuscar, volverAMontar } = montar();
      escribir(entrada, "imp");
      esperar(300);
      expect(alBuscar.mock.calls).toEqual([["imp"]]);
      escribir(entrada, "impre");
      volverAMontar("imp");
      expect(entrada).toHaveValue("impre");
      esperar(300);
      expect(alBuscar.mock.calls).toEqual([["imp"], ["impre"]]);
    });

    it("no consulta solo por montarse ni por recibir el mismo valor", () => {
      const { alBuscar, volverAMontar } = montar("red");
      volverAMontar("red");
      esperar(1000);
      expect(alBuscar).not.toHaveBeenCalled();
    });
  });

  it("al desmontarse no consulta lo pendiente", () => {
    const alBuscar = vi.fn();
    const { unmount } = render(<Buscador valor="" alBuscar={alBuscar} />);
    escribir(screen.getByRole("searchbox", { name: "Buscar tickets" }), "red");
    unmount();
    esperar(1000);
    expect(alBuscar).not.toHaveBeenCalled();
  });
});
