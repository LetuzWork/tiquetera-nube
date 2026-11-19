import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { completarDias, rangoDePeriodo, serie } from "../reportes/reportes";
import { fechaCortaDeDia } from "../utils/zona";
import type { PuntoGrafico } from "./GraficoBarras";
import { GraficoColumnas } from "./GraficoColumnas";

function porDia(hoy: string, periodo: "7" | "30" | "90", conteos: Record<string, number>): PuntoGrafico[] {
  return serie(completarDias(conteos, rangoDePeriodo(periodo, hoy))).map((punto) => ({
    ...punto,
    etiqueta: fechaCortaDeDia(punto.clave),
  }));
}

const SIETE_DIAS = porDia("2026-11-17", "7", { "2026-11-12": 2, "2026-11-16": 1, "2026-11-17": 4 });

function montar(datos: readonly PuntoGrafico[], extra: { maxEtiquetas?: number; textoVacio?: string } = {}) {
  render(<GraficoColumnas titulo="Por día" datos={datos} columna="Día" {...extra} />);
  return screen.getByRole("region", { name: "Por día" });
}

function parteVisual(region: HTMLElement): HTMLElement {
  const visual = region.querySelector<HTMLElement>('[aria-hidden="true"]');
  if (!visual) throw new Error("El gráfico no tiene parte visual");
  return visual;
}

function etiquetasVisibles(visual: HTMLElement, datos: readonly PuntoGrafico[]): string[] {
  return datos
    .map((punto) => within(visual).getByText(punto.etiqueta))
    .filter((etiqueta) => !etiqueta.hasAttribute("data-oculta"))
    .map((etiqueta) => etiqueta.textContent ?? "");
}

describe("GraficoColumnas", () => {
  it("RF-30: es una sección nombrada por su título h2, con una columna por día", () => {
    const region = montar(SIETE_DIAS);
    expect(within(region).getByRole("heading", { level: 2, name: "Por día" })).toBeInTheDocument();
    expect(parteVisual(region).style.getPropertyValue("--tq-columnas")).toBe("7");
  });

  it("RF-30: con 10 columnas o menos, cada una lleva el valor escrito arriba y la fecha corta debajo", () => {
    const visual = parteVisual(montar(SIETE_DIAS));
    const columnas = SIETE_DIAS.map((punto) => within(visual).getByText(punto.etiqueta).parentElement);
    expect(columnas.map((columna) => columna?.textContent)).toEqual([
      "011 nov",
      "212 nov",
      "013 nov",
      "014 nov",
      "015 nov",
      "116 nov",
      "417 nov",
    ]);
    expect(visual.querySelectorAll('[data-oculto="true"]')).toHaveLength(0);
  });

  it("con más de 10 columnas, el valor queda solo en la tabla", () => {
    const treinta = porDia("2026-11-17", "30", { "2026-11-17": 3 });
    const visual = parteVisual(montar(treinta));
    expect(visual.querySelectorAll('[data-oculto="true"]')).toHaveLength(30);
  });

  it("muestra a lo sumo 5 fechas, cada k columnas, y siempre la última", () => {
    const visual = parteVisual(montar(SIETE_DIAS));
    expect(etiquetasVisibles(visual, SIETE_DIAS)).toEqual(["11 nov", "13 nov", "15 nov", "17 nov"]);
  });

  it("con 30 días, las fechas van cada 6 y la de hoy siempre se ve", () => {
    const treinta = porDia("2026-11-17", "30", {});
    const visual = parteVisual(montar(treinta));
    expect(etiquetasVisibles(visual, treinta)).toEqual(["24 oct", "30 oct", "5 nov", "11 nov", "17 nov"]);
  });

  it("con 90 días entran las 90 columnas y siguen siendo 5 fechas", () => {
    const noventa = porDia("2026-11-17", "90", {});
    const region = montar(noventa);
    expect(parteVisual(region).style.getPropertyValue("--tq-columnas")).toBe("90");
    expect(etiquetasVisibles(parteVisual(region), noventa)).toHaveLength(5);
    expect(within(region).getAllByRole("row")).toHaveLength(91);
  });

  it("maxEtiquetas cambia cuántas fechas se ven", () => {
    const visual = parteVisual(montar(SIETE_DIAS, { maxEtiquetas: 7 }));
    expect(etiquetasVisibles(visual, SIETE_DIAS)).toHaveLength(7);
  });

  it("el alto de cada columna es su fracción del máximo; un día en cero se marca vacío", () => {
    const visual = parteVisual(montar(SIETE_DIAS));
    const barras = [...visual.querySelectorAll<HTMLElement>('[style*="--tq-fraccion"]')];
    expect(barras.map((barra) => barra.style.getPropertyValue("--tq-fraccion"))).toEqual([
      "0",
      "0.5",
      "0",
      "0",
      "0",
      "0.25",
      "1",
    ]);
    expect(visual.querySelectorAll('[data-vacia="true"]')).toHaveLength(4);
  });

  it("RF-30: la lectura para lectores es una tabla con todos los días y sus valores", () => {
    const region = montar(SIETE_DIAS);
    const tabla = within(region).getByRole("table");
    expect(parteVisual(region)).not.toContainElement(tabla);
    expect(tabla.parentElement).toHaveClass("tq-solo-lectores");
    expect(within(tabla).getAllByRole("columnheader").map((celda) => celda.textContent)).toEqual(["Día", "Tickets"]);
    expect(within(tabla).getAllByRole("rowheader").map((celda) => celda.textContent)).toEqual(
      SIETE_DIAS.map((punto) => punto.etiqueta),
    );
    expect(within(tabla).getAllByRole("cell").map((celda) => celda.textContent)).toEqual(["0", "2", "0", "0", "0", "1", "4"]);
  });

  it("RF-30: sin datos dice 'Sin tickets en el período.'", () => {
    const region = montar([]);
    expect(within(region).getByText("Sin tickets en el período.")).toBeInTheDocument();
    expect(within(region).queryByRole("table")).not.toBeInTheDocument();
    expect(region.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("el texto vacío se puede cambiar", () => {
    const region = montar([], { textoVacio: "Nada por acá." });
    expect(within(region).getByText("Nada por acá.")).toBeInTheDocument();
  });
});
