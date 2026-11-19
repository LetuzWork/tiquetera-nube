import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ESTADOS } from "../api/types";
import { serie } from "../reportes/reportes";
import { ETIQUETA_ESTADO } from "../utils/presentacion";
import { GraficoBarras, TablaDelGrafico, type PuntoGrafico } from "./GraficoBarras";

const POR_ESTADO: PuntoGrafico[] = serie({ ABIERTO: 4, EN_PROGRESO: 2, RESUELTO: 1 }, ESTADOS, ETIQUETA_ESTADO).map(
  (punto) => ({ ...punto, color: `var(--tq-estado-${punto.clave.toLowerCase()})` }),
);

function montar(datos: readonly PuntoGrafico[] = POR_ESTADO, extra: { columnaValor?: string; textoVacio?: string } = {}) {
  render(<GraficoBarras titulo="Por estado" datos={datos} columna="Estado" {...extra} />);
  return screen.getByRole("region", { name: "Por estado" });
}

function parteVisual(region: HTMLElement): HTMLElement {
  const visual = region.querySelector<HTMLElement>('[aria-hidden="true"]');
  if (!visual) throw new Error("El gráfico no tiene parte visual");
  return visual;
}

describe("GraficoBarras", () => {
  it("RF-30: es una sección nombrada por su título h2", () => {
    const region = montar();
    expect(within(region).getByRole("heading", { level: 2, name: "Por estado" })).toBeInTheDocument();
  });

  it("RF-30: cada barra lleva su etiqueta y el valor escrito al final", () => {
    const visual = parteVisual(montar());
    const filas = ["Abierto", "En progreso", "Resuelto", "Cerrado"].map(
      (etiqueta) => within(visual).getByText(etiqueta).parentElement?.textContent,
    );
    expect(filas).toEqual(["Abierto4", "En progreso2", "Resuelto1", "Cerrado0"]);
  });

  it("el largo de cada barra es su fracción del máximo, con su color", () => {
    const visual = parteVisual(montar());
    const barras = [...visual.querySelectorAll<HTMLElement>('[style*="--tq-fraccion"]')];
    expect(barras.map((barra) => barra.style.getPropertyValue("--tq-fraccion"))).toEqual(["1", "0.5", "0.25", "0"]);
    expect(barras[1]?.style.getPropertyValue("--tq-color-barra")).toBe("var(--tq-estado-en_progreso)");
  });

  it("una barra en cero se marca vacía", () => {
    const visual = parteVisual(montar());
    expect(visual.querySelectorAll('[data-vacia="true"]')).toHaveLength(1);
  });

  it("RF-30: la parte visual es decorativa y la lectura va en una tabla para lectores", () => {
    const region = montar();
    const tabla = within(region).getByRole("table");
    expect(within(region).getAllByRole("table")).toHaveLength(1);
    expect(parteVisual(region)).not.toContainElement(tabla);
    expect(tabla.parentElement).toHaveClass("tq-solo-lectores");
    expect(within(tabla).getAllByRole("columnheader").map((celda) => celda.textContent)).toEqual(["Estado", "Tickets"]);
    expect(within(tabla).getAllByRole("rowheader").map((celda) => celda.textContent)).toEqual([
      "Abierto",
      "En progreso",
      "Resuelto",
      "Cerrado",
    ]);
    expect(within(tabla).getAllByRole("cell").map((celda) => celda.textContent)).toEqual(["4", "2", "1", "0"]);
  });

  it("la tabla acepta otro nombre para la columna del valor", () => {
    const region = montar(POR_ESTADO, { columnaValor: "Cantidad" });
    expect(within(region).getByRole("columnheader", { name: "Cantidad" })).toBeInTheDocument();
  });

  it("RF-30: sin datos dice 'Sin tickets en el período.' y no dibuja ni tabla ni barras", () => {
    const region = montar([]);
    expect(within(region).getByText("Sin tickets en el período.")).toBeInTheDocument();
    expect(within(region).queryByRole("table")).not.toBeInTheDocument();
    expect(region.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("el texto vacío se puede cambiar", () => {
    const region = montar([], { textoVacio: "Todavía no hay responsables." });
    expect(within(region).getByText("Todavía no hay responsables.")).toBeInTheDocument();
  });
});

describe("TablaDelGrafico", () => {
  it("una fila por punto, con la etiqueta como encabezado de fila", () => {
    render(
      <TablaDelGrafico
        datos={serie({ "u.operador": 3, "sin asignar": 1 }, undefined, { "sin asignar": "Sin asignar" })}
        columna="Responsable"
        columnaValor="Tickets"
      />,
    );
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas.map((fila) => within(fila).getByRole("rowheader").textContent)).toEqual(["u.operador", "Sin asignar"]);
    expect(filas.map((fila) => within(fila).getByRole("cell").textContent)).toEqual(["3", "1"]);
    expect(screen.getByRole("columnheader", { name: "Responsable" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("rowheader", { name: "u.operador" })).toHaveAttribute("scope", "row");
  });
});
