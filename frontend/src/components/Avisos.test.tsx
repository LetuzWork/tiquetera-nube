import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MS_AVISO, ProveedorAvisos, useAvisos, type ValorAvisos } from "./Avisos";

// Temporizadores falsos puros: los bordes de 3999 y 4000 ms tienen que ser exactos.
beforeEach(() => {
  vi.useFakeTimers();
});

let avisos: ValorAvisos;

function Consumidor() {
  avisos = useAvisos();
  return <button type="button">Seguir trabajando</button>;
}

function montar(avisoFijo?: ReactNode) {
  return render(
    <ProveedorAvisos avisoFijo={avisoFijo}>
      <Consumidor />
    </ProveedorAvisos>,
  );
}

function confirmar(texto: string) {
  act(() => avisos.confirmar(texto));
}

function fallar(texto: string) {
  act(() => avisos.fallar(texto));
}

function esperar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const region = () => screen.getByRole("status");
const cerrarAviso = () => screen.getByRole("button", { name: "Cerrar aviso" });

describe("Avisos (RF-27)", () => {
  it("sin avisos no monta ninguna región, así no compite con el aviso de sesión", () => {
    montar();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
  });

  it("RF-18: la confirmación se anuncia con role=status y ofrece 'Cerrar aviso'", () => {
    montar();
    confirmar("Ticket TQ-000054 creado");
    expect(region()).toHaveTextContent("Ticket TQ-000054 creado");
    expect(cerrarAviso()).toBeInTheDocument();
  });

  it("la confirmación se cierra sola a los 4 s, no antes", () => {
    expect(MS_AVISO).toBe(4000);
    montar();
    confirmar("Estado actualizado");
    esperar(3999);
    expect(region()).toHaveTextContent("Estado actualizado");
    esperar(1);
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar aviso" })).not.toBeInTheDocument();
  });

  it("al cerrarse, la región queda montada y vacía, y el siguiente aviso usa la misma", () => {
    montar();
    confirmar("Estado actualizado");
    const primera = region();
    esperar(MS_AVISO);
    expect(region()).toBe(primera);
    expect(primera).toBeEmptyDOMElement();
    confirmar("Prioridad actualizada");
    expect(region()).toBe(primera);
    expect(primera).toHaveTextContent("Prioridad actualizada");
  });

  it("'Cerrar aviso' lo cierra en el momento", () => {
    montar();
    confirmar("Responsable actualizado");
    fireEvent.click(cerrarAviso());
    expect(screen.queryByText("Responsable actualizado")).not.toBeInTheDocument();
    expect(region()).toBeEmptyDOMElement();
  });

  it("aparecer no le saca el foco a quien lo tiene", () => {
    montar();
    const boton = screen.getByRole("button", { name: "Seguir trabajando" });
    act(() => boton.focus());
    confirmar("Categoría actualizada");
    expect(boton).toHaveFocus();
  });

  describe("pausa", () => {
    it("con el puntero encima la cuenta se detiene, y al salir sigue con lo que faltaba", () => {
      montar();
      confirmar("Estado actualizado");
      esperar(3000);
      fireEvent.pointerEnter(region());
      esperar(10_000);
      expect(region()).toHaveTextContent("Estado actualizado");
      fireEvent.pointerLeave(region());
      esperar(999);
      expect(region()).toHaveTextContent("Estado actualizado");
      esperar(1);
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    });

    it("con el foco adentro la cuenta se detiene, y al salir sigue con lo que faltaba", () => {
      montar();
      confirmar("Estado actualizado");
      esperar(1000);
      act(() => cerrarAviso().focus());
      esperar(60_000);
      expect(region()).toHaveTextContent("Estado actualizado");
      act(() => screen.getByRole("button", { name: "Seguir trabajando" }).focus());
      esperar(2999);
      expect(region()).toHaveTextContent("Estado actualizado");
      esperar(1);
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    });

    it("con puntero y foco, sigue en pausa hasta que se van los dos", () => {
      montar();
      confirmar("Estado actualizado");
      fireEvent.pointerEnter(region());
      act(() => cerrarAviso().focus());
      fireEvent.pointerLeave(region());
      esperar(10_000);
      expect(region()).toHaveTextContent("Estado actualizado");
      act(() => screen.getByRole("button", { name: "Seguir trabajando" }).focus());
      esperar(MS_AVISO);
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("RF-24: se anuncia con role=alert y no se cierra solo", () => {
      montar();
      fallar("No se pudo aplicar el cambio.");
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo aplicar el cambio.");
      esperar(10 * 60_000);
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo aplicar el cambio.");
    });

    it("se cierra con 'Cerrar aviso'", () => {
      montar();
      fallar("No se pudo aplicar el cambio.");
      fireEvent.click(cerrarAviso());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("No se pudo aplicar el cambio.")).not.toBeInTheDocument();
    });

    it("no se anuncia en la región de las confirmaciones", () => {
      montar();
      fallar("No se pudo aplicar el cambio.");
      expect(region()).toBeEmptyDOMElement();
      expect(screen.getAllByRole("button", { name: "Cerrar aviso" })).toHaveLength(1);
    });
  });

  describe("reemplazo", () => {
    it("una confirmación nueva reemplaza a la anterior y cuenta sus 4 s desde que llega", () => {
      montar();
      confirmar("Estado actualizado");
      esperar(3000);
      confirmar("Responsable actualizado");
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
      expect(region()).toHaveTextContent("Responsable actualizado");
      esperar(3999);
      expect(region()).toHaveTextContent("Responsable actualizado");
      esperar(1);
      expect(screen.queryByText("Responsable actualizado")).not.toBeInTheDocument();
    });

    it("el mismo texto dos veces se vuelve a anunciar y vuelve a contar", () => {
      montar();
      confirmar("Estado actualizado");
      const primero = screen.getByText("Estado actualizado");
      esperar(3000);
      confirmar("Estado actualizado");
      const segundo = screen.getByText("Estado actualizado");
      expect(segundo).not.toBe(primero);
      esperar(3999);
      expect(region()).toHaveTextContent("Estado actualizado");
      esperar(1);
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    });

    it("un error reemplaza a la confirmación", () => {
      montar();
      confirmar("Estado actualizado");
      fallar("No se pudo aplicar el cambio.");
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo aplicar el cambio.");
      expect(screen.getAllByRole("button", { name: "Cerrar aviso" })).toHaveLength(1);
    });

    it("una confirmación reemplaza al error y se cierra a los 4 s", () => {
      montar();
      fallar("No se pudo aplicar el cambio.");
      confirmar("Estado actualizado");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(region()).toHaveTextContent("Estado actualizado");
      esperar(MS_AVISO);
      expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
    });

    it("un error que llega en pausa no hereda la pausa de la confirmación", () => {
      montar();
      confirmar("Estado actualizado");
      fireEvent.pointerEnter(region());
      fallar("No se pudo aplicar el cambio.");
      confirmar("Prioridad actualizada");
      esperar(MS_AVISO);
      expect(screen.queryByText("Prioridad actualizada")).not.toBeInTheDocument();
    });
  });

  it("cerrar() quita el aviso que esté", () => {
    montar();
    fallar("No se pudo aplicar el cambio.");
    act(() => avisos.cerrar());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("avisoFijo", () => {
    it("se muestra debajo de los avisos y no lo tocan ni las confirmaciones ni su cierre", () => {
      montar(<p>Tu sesión vence a las 10:00.</p>);
      const fijo = screen.getByText("Tu sesión vence a las 10:00.");
      confirmar("Estado actualizado");
      expect(region().compareDocumentPosition(fijo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      esperar(MS_AVISO);
      expect(screen.getByText("Tu sesión vence a las 10:00.")).toBe(fijo);
      fallar("No se pudo aplicar el cambio.");
      expect(screen.getByText("Tu sesión vence a las 10:00.")).toBe(fijo);
    });

    it("el contenido de la página va antes que la pila de avisos", () => {
      montar(<p>Tu sesión vence a las 10:00.</p>);
      const boton = screen.getByRole("button", { name: "Seguir trabajando" });
      const fijo = screen.getByText("Tu sesión vence a las 10:00.");
      expect(boton.compareDocumentPosition(fijo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("useAvisos fuera del proveedor lanza un error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Consumidor />)).toThrow("useAvisos debe usarse dentro de <ProveedorAvisos>");
  });
});
