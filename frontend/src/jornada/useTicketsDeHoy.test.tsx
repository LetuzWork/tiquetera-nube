import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { tickets } from "../api/endpoints";
import type { Pagina } from "../api/types";
import { paginaDe, ticketResumenDe } from "../test/fabricas";
import { avanzar, cambiarVisibilidad, relojFalso } from "../test/tiempo";
import { useTicketsDeHoy } from "./useTicketsDeHoy";

const HOY = "2026-11-17";
const MINUTO = 60_000;

interface Sondeo {
  valor: () => { pagina: Pagina | null; fallo: boolean };
  navegar: (ruta: string) => Promise<void>;
  cambiar: (hoy: string | null, pausado: boolean) => Promise<void>;
}

async function montar(hoy: string | null, pausado = false): Promise<Sondeo> {
  const ultimo: { valor: { pagina: Pagina | null; fallo: boolean } | null; navegar: NavigateFunction | null } = {
    valor: null,
    navegar: null,
  };
  function Sonda(props: { hoy: string | null; pausado: boolean }) {
    ultimo.valor = useTicketsDeHoy(props.hoy, props.pausado);
    ultimo.navegar = useNavigate();
    return null;
  }
  const arbol = (h: string | null, p: boolean) => (
    <MemoryRouter initialEntries={["/bandeja"]}>
      <Sonda hoy={h} pausado={p} />
    </MemoryRouter>
  );
  let volverARenderizar: (nuevo: ReturnType<typeof arbol>) => void = () => undefined;
  await act(async () => {
    volverARenderizar = render(arbol(hoy, pausado)).rerender;
  });
  return {
    valor: () => {
      if (!ultimo.valor) throw new Error("La sonda no se montó");
      return ultimo.valor;
    },
    navegar: async (ruta) => {
      await act(async () => {
        void ultimo.navegar?.(ruta);
      });
    },
    cambiar: async (h, p) => {
      await act(async () => {
        volverARenderizar(arbol(h, p));
      });
    },
  };
}

describe("useTicketsDeHoy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("pide los tickets de hoy con ({ desde, hasta }, 1, 100)", async () => {
    const pagina = paginaDe([ticketResumenDe({ numero: 49 }), ticketResumenDe({ numero: 45 })], { por_pagina: 100 });
    const listar = vi.spyOn(tickets, "listar").mockResolvedValue(pagina);
    const sonda = await montar(HOY);
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith({ desde: HOY, hasta: HOY }, 1, 100);
    expect(sonda.valor()).toEqual({ pagina, fallo: false });
  });

  it("sin hoy no pide nada", async () => {
    const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
    const sonda = await montar(null);
    expect(listar).not.toHaveBeenCalled();
    expect(sonda.valor()).toEqual({ pagina: null, fallo: false });
  });

  it("vuelve a pedir al cambiar hoy", async () => {
    const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
    const sonda = await montar(HOY);
    await sonda.cambiar("2026-11-18", false);
    expect(listar).toHaveBeenCalledTimes(2);
    expect(listar).toHaveBeenLastCalledWith({ desde: "2026-11-18", hasta: "2026-11-18" }, 1, 100);
  });

  describe("RF-15: atraso máximo de 5 minutos", () => {
    it("vuelve a pedir a los 5 minutos", async () => {
      const reloj = relojFalso();
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
      await montar(HOY);
      await avanzar(4 * MINUTO + 59_000, reloj);
      expect(listar).toHaveBeenCalledTimes(1);
      await avanzar(1_000, reloj);
      expect(listar).toHaveBeenCalledTimes(2);
    });

    it("vuelve a pedir al cambiar de sección", async () => {
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
      const sonda = await montar(HOY);
      await sonda.navegar("/reportes");
      expect(listar).toHaveBeenCalledTimes(2);
      await sonda.navegar("/tickets/45");
      expect(listar).toHaveBeenCalledTimes(3);
    });

    it("vuelve a pedir al volver a la pestaña, no al ocultarla", async () => {
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
      await montar(HOY);
      await cambiarVisibilidad("hidden");
      expect(listar).toHaveBeenCalledTimes(1);
      await cambiarVisibilidad("visible");
      expect(listar).toHaveBeenCalledTimes(2);
    });
  });

  describe("RF-13: falla", () => {
    it("si la consulta falla, marca fallo y no deja página", async () => {
      vi.spyOn(tickets, "listar").mockRejectedValue(new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {}));
      const sonda = await montar(HOY);
      expect(sonda.valor()).toEqual({ pagina: null, fallo: true });
    });

    it("una falla después de un éxito no conserva las marcas anteriores", async () => {
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([ticketResumenDe()]));
      const sonda = await montar(HOY);
      expect(sonda.valor().pagina?.total).toBe(1);
      listar.mockRejectedValue(new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {}));
      await sonda.navegar("/reportes");
      expect(sonda.valor()).toEqual({ pagina: null, fallo: true });
    });

    it("un éxito después de una falla la limpia", async () => {
      const listar = vi
        .spyOn(tickets, "listar")
        .mockRejectedValue(new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {}));
      const sonda = await montar(HOY);
      const pagina = paginaDe([]);
      listar.mockResolvedValue(pagina);
      await sonda.navegar("/reportes");
      expect(sonda.valor()).toEqual({ pagina, fallo: false });
    });
  });

  describe("pausa (D-08)", () => {
    it("no pide nada mientras está en pausa", async () => {
      const reloj = relojFalso();
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
      const sonda = await montar(HOY, true);
      await avanzar(5 * MINUTO, reloj);
      await sonda.navegar("/reportes");
      await cambiarVisibilidad("visible");
      expect(listar).not.toHaveBeenCalled();
    });

    it("al salir de la pausa vuelve a pedir y retoma el ciclo", async () => {
      const reloj = relojFalso();
      const listar = vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
      const sonda = await montar(HOY);
      await sonda.cambiar(HOY, true);
      await avanzar(5 * MINUTO, reloj);
      expect(listar).toHaveBeenCalledTimes(1);
      await sonda.cambiar(HOY, false);
      expect(listar).toHaveBeenCalledTimes(2);
      await avanzar(5 * MINUTO, reloj);
      expect(listar).toHaveBeenCalledTimes(3);
    });
  });
});
