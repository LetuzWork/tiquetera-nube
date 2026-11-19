import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth } from "../api/endpoints";
import type { Horario } from "../api/types";
import { horarioDe, ZONA_PRUEBA } from "../test/fabricas";
import { avanzar, cambiarVisibilidad, horarioQueAvanza, relojFalso, type RelojFalso } from "../test/tiempo";
import { instanteDe, ZONA_RESPALDO } from "../utils/zona";
import { ProveedorJornada, useJornada, type ValorJornada } from "./JornadaContext";

const MARTES_1420 = "2026-11-17T17:20:00Z";
const MINUTO = 60_000;

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

function servidor(ahoraIso: string, reloj: RelojFalso, cambios: Partial<Horario> = {}) {
  return vi.spyOn(auth, "horario").mockImplementation(horarioQueAvanza(horarioDe(ahoraIso, cambios), reloj));
}

async function montar(reloj: RelojFalso) {
  const ultimo: { valor: ValorJornada | null } = { valor: null };
  function Sonda() {
    ultimo.valor = useJornada();
    return null;
  }
  await act(async () => {
    render(
      <ProveedorJornada relojMonotono={reloj.ahora}>
        <Sonda />
      </ProveedorJornada>,
    );
  });
  return () => {
    if (!ultimo.valor) throw new Error("La sonda no se montó");
    return ultimo.valor;
  };
}

describe("ProveedorJornada", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  describe("RF-1: la hora del servidor avanza con el reloj monotónico", () => {
    it("con el dispositivo en 2020, 30 min del reloj monotónico son 30 min del servidor", async () => {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const reloj = relojFalso(1_000);
      servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420));
      expect(valor().jornada?.reloj).toBe("14:20");
      await avanzar(30 * MINUTO, reloj);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420) + 30 * MINUTO);
      expect(valor().jornada?.reloj).toBe("14:50");
    });

    it("vi.setSystemTime no mueve la hora mostrada", async () => {
      const reloj = relojFalso();
      servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      const antes = valor().ahora;
      vi.setSystemTime(new Date("2035-06-01T03:00:00Z"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(valor().ahora).toBe(antes);
      expect(valor().jornada?.reloj).toBe("14:20");
    });

    it("mide el desfase en el punto medio del pedido", async () => {
      const reloj = relojFalso(10_000);
      vi.spyOn(auth, "horario").mockImplementation(async () => {
        reloj.mover(400);
        return horarioDe(MARTES_1420);
      });
      const valor = await montar(reloj);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420) + 200);
    });

    it("calcula en la zona de la franja (RF-3)", async () => {
      const reloj = relojFalso();
      servidor(MARTES_1420, reloj, { zona: "Europe/Madrid" });
      const valor = await montar(reloj);
      expect(valor().zona).toBe("Europe/Madrid");
      expect(valor().jornada?.reloj).toBe("18:20");
    });

    it("antes de tener la franja, la zona es la de respaldo", async () => {
      vi.spyOn(auth, "horario").mockReturnValue(new Promise<Horario>(() => undefined));
      const valor = await montar(relojFalso());
      expect(valor().zona).toBe(ZONA_RESPALDO);
    });
  });

  describe("RF-2: recálculo y nuevas consultas", () => {
    it("recalcula la hora con el tic de 30 s", async () => {
      const reloj = relojFalso();
      servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      const inicio = instanteDe(MARTES_1420);
      await avanzar(29_000, reloj);
      expect(valor().ahora).toBe(inicio);
      await avanzar(1_000, reloj);
      expect(valor().ahora).toBe(inicio + 30_000);
    });

    it("al volver a la pestaña recalcula al instante y vuelve a consultar", async () => {
      const reloj = relojFalso();
      const espia = servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      expect(espia).toHaveBeenCalledTimes(1);
      espia.mockReturnValue(new Promise<Horario>(() => undefined));
      reloj.mover(10 * MINUTO);
      await cambiarVisibilidad("hidden");
      expect(espia).toHaveBeenCalledTimes(1);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420));
      await cambiarVisibilidad("visible");
      expect(valor().ahora).toBe(instanteDe(MARTES_1420) + 10 * MINUTO);
      expect(espia).toHaveBeenCalledTimes(2);
    });

    it("vuelve a consultar la franja a los 5 minutos", async () => {
      const reloj = relojFalso();
      const espia = servidor(MARTES_1420, reloj);
      await montar(reloj);
      await avanzar(4 * MINUTO + 59_000, reloj);
      expect(espia).toHaveBeenCalledTimes(1);
      await avanzar(1_000, reloj);
      expect(espia).toHaveBeenCalledTimes(2);
    });

    it("vuelve a consultar al pasar a cerrada", async () => {
      const reloj = relojFalso();
      const espia = servidor("2026-11-17T20:59:00Z", reloj);
      const valor = await montar(reloj);
      expect(valor().jornada?.estado).toBe("por-cerrar");
      expect(espia).toHaveBeenCalledTimes(1);
      await avanzar(MINUTO, reloj);
      expect(valor().jornada?.estado).toBe("cerrada");
      expect(espia).toHaveBeenCalledTimes(2);
    });

    it("vuelve a consultar al salir de cerrada", async () => {
      const reloj = relojFalso();
      const espia = servidor("2026-11-17T10:59:00Z", reloj);
      const valor = await montar(reloj);
      expect(valor().jornada?.estado).toBe("cerrada");
      expect(espia).toHaveBeenCalledTimes(1);
      await avanzar(MINUTO, reloj);
      expect(valor().jornada?.estado).toBe("abierta");
      expect(espia).toHaveBeenCalledTimes(2);
    });

    it("no consulta de más en la primera carga, aunque esté cerrada", async () => {
      const reloj = relojFalso();
      const espia = servidor("2026-11-17T22:00:00Z", reloj);
      const valor = await montar(reloj);
      await avanzar(1_000, reloj);
      expect(valor().jornada?.estado).toBe("cerrada");
      expect(espia).toHaveBeenCalledTimes(1);
    });
  });

  describe("RF-9: sin franja", () => {
    it("mientras carga, el cielo es null y no hay hora", async () => {
      vi.spyOn(auth, "horario").mockReturnValue(new Promise<Horario>(() => undefined));
      const valor = await montar(relojFalso());
      expect(valor().cielo).toBeNull();
      expect(valor().sinFranja).toBe(false);
      expect(valor().horario).toBeNull();
      expect(valor().ahora).toBeNull();
      expect(valor().jornada).toBeNull();
    });

    it("con la falla inicial marca sinFranja y usa el cielo de las 13:00", async () => {
      vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
      const valor = await montar(relojFalso());
      expect(valor().sinFranja).toBe(true);
      expect(valor().cielo).toEqual({ arriba: "#4f98f0", abajo: "#e3f0ff", tinta: "#14233c" });
      expect(valor().ahora).toBeNull();
      expect(valor().jornada).toBeNull();
    });

    it("con una falla posterior conserva la franja y la hora sigue", async () => {
      const reloj = relojFalso();
      const espia = servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      const franja = valor().horario;
      espia.mockRejectedValue(sinConexion());
      await avanzar(5 * MINUTO, reloj);
      expect(espia).toHaveBeenCalledTimes(2);
      expect(valor().sinFranja).toBe(false);
      expect(valor().horario).toBe(franja);
      expect(valor().zona).toBe(ZONA_PRUEBA);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420) + 5 * MINUTO);
      await avanzar(30_000, reloj);
      expect(valor().ahora).toBe(instanteDe(MARTES_1420) + 5 * MINUTO + 30_000);
    });

    it("reintenta en el ciclo siguiente", async () => {
      const reloj = relojFalso();
      const espia = vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
      const valor = await montar(reloj);
      expect(valor().sinFranja).toBe(true);
      espia.mockImplementation(horarioQueAvanza(horarioDe(MARTES_1420), reloj));
      await avanzar(5 * MINUTO, reloj);
      expect(valor().sinFranja).toBe(false);
      expect(valor().horario?.zona).toBe(ZONA_PRUEBA);
      expect(valor().jornada?.reloj).toBe("14:25");
      expect(valor().cielo).not.toBeNull();
    });
  });

  describe("actualizar()", () => {
    it("devuelve la franja que llegó", async () => {
      const reloj = relojFalso();
      servidor(MARTES_1420, reloj);
      const valor = await montar(reloj);
      let resultado: Horario | null = null;
      await act(async () => {
        resultado = await valor().actualizar();
      });
      expect(resultado).toEqual(horarioDe(new Date(instanteDe(MARTES_1420)).toISOString()));
      expect(valor().horario).toBe(resultado);
    });

    it("devuelve null si falla y nunca llegó una franja", async () => {
      vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
      const valor = await montar(relojFalso());
      let resultado: Horario | null | undefined;
      await act(async () => {
        resultado = await valor().actualizar();
      });
      expect(resultado).toBeNull();
    });
  });
});
