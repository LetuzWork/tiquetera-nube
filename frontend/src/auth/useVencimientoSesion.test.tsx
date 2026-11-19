import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth } from "../api/endpoints";
import { ProveedorJornada } from "../jornada/JornadaContext";
import { horarioDe, meDe } from "../test/fabricas";
import { avanzar, horarioQueAvanza, relojFalso, type RelojFalso } from "../test/tiempo";
import { ProveedorAuth, useAuth, type ValorAuth } from "./AuthContext";
import { useVencimientoSesion } from "./useVencimientoSesion";

const MINUTO = 60_000;

const sinConexion = () => new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {});

function servidor(ahoraIso: string, reloj: RelojFalso) {
  return vi.spyOn(auth, "horario").mockImplementation(horarioQueAvanza(horarioDe(ahoraIso), reloj));
}

function sesionQueVence(sesionExpira: string, segundosRestantes: number) {
  return meDe("operador", { sesion_expira: sesionExpira, segundos_restantes: segundosRestantes });
}

interface Lectura {
  vencimiento: { aviso: string | null; cerrarAviso: () => void };
  auth: ValorAuth;
}

async function montar(reloj: RelojFalso): Promise<() => Lectura> {
  const ultimo: { lectura: Lectura | null } = { lectura: null };
  function Sonda() {
    ultimo.lectura = { vencimiento: useVencimientoSesion(), auth: useAuth() };
    return null;
  }
  await act(async () => {
    render(
      <ProveedorAuth relojMonotono={reloj.ahora}>
        <ProveedorJornada relojMonotono={reloj.ahora}>
          <Sonda />
        </ProveedorJornada>
      </ProveedorAuth>,
    );
  });
  return () => {
    if (!ultimo.lectura) throw new Error("La sonda no se montó");
    return ultimo.lectura;
  };
}

describe("useVencimientoSesion", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  describe("RF-21: aviso de 5 minutos", () => {
    it("sale a los 5 minutos del vencimiento, una sola vez por sesión", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:30:00-03:00", 600));
      const leer = await montar(reloj);
      expect(leer().vencimiento.aviso).toBeNull();
      await avanzar(4 * MINUTO + 59_000, reloj);
      expect(leer().vencimiento.aviso).toBeNull();
      await avanzar(1_000, reloj);
      expect(leer().vencimiento.aviso).toBe("Tu sesión vence a las 14:30.");
      await act(async () => {
        leer().vencimiento.cerrarAviso();
      });
      expect(leer().vencimiento.aviso).toBeNull();
      await avanzar(2 * MINUTO, reloj);
      expect(leer().vencimiento.aviso).toBeNull();
    });

    it("sale al abrir si ya faltan 5 minutos o menos", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:23:00-03:00", 180));
      const leer = await montar(reloj);
      expect(leer().vencimiento.aviso).toBe("Tu sesión vence a las 14:23.");
    });

    it("una sesión nueva vuelve a avisar", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:23:00-03:00", 180));
      const leer = await montar(reloj);
      await act(async () => {
        leer().vencimiento.cerrarAviso();
      });
      vi.spyOn(auth, "login").mockResolvedValue(sesionQueVence("2026-11-17T14:24:00-03:00", 240));
      await act(async () => {
        await leer().auth.iniciarSesion("u.operador", "secreta");
      });
      expect(leer().vencimiento.aviso).toBe("Tu sesión vence a las 14:24.");
    });

    it("sale a tiempo por el temporizador del umbral, sin esperar el tic", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:30:10-03:00", 610));
      const leer = await montar(reloj);
      await avanzar(5 * MINUTO + 9_000, reloj);
      expect(leer().vencimiento.aviso).toBeNull();
      await avanzar(1_000, reloj);
      expect(leer().vencimiento.aviso).toBe("Tu sesión vence a las 14:30.");
    });
  });

  describe("RF-22: fin de la sesión", () => {
    it("al vencer a las 18:00 con franja, termina por la jornada", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T20:59:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T18:00:00-03:00", 60));
      const leer = await montar(reloj);
      await avanzar(59_000, reloj);
      expect(leer().auth.fin).toBeNull();
      await avanzar(1_000, reloj);
      expect(leer().auth.fin).toBe("jornada");
      expect(leer().auth.me).not.toBeNull();
    });

    it("al vencer dentro de la franja, termina por la duración", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:29:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:30:00-03:00", 60));
      const leer = await montar(reloj);
      await avanzar(59_000, reloj);
      expect(leer().auth.fin).toBeNull();
      await avanzar(1_000, reloj);
      expect(leer().auth.fin).toBe("duracion");
    });

    it("termina a tiempo por el temporizador, sin esperar el tic", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T14:20:10-03:00", 10));
      const leer = await montar(reloj);
      await avanzar(9_000, reloj);
      expect(leer().auth.fin).toBeNull();
      await avanzar(1_000, reloj);
      expect(leer().auth.fin).toBe("duracion");
    });

    it("al vencer sin franja, la vuelve a consultar y decide por la respuesta", async () => {
      const reloj = relojFalso();
      const horario = vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T18:00:00-03:00", 60));
      const leer = await montar(reloj);
      horario.mockImplementation(horarioQueAvanza(horarioDe("2026-11-17T20:59:00Z"), reloj));
      await avanzar(59_000, reloj);
      expect(leer().auth.fin).toBeNull();
      expect(horario).toHaveBeenCalledTimes(1);
      await avanzar(1_000, reloj);
      expect(horario).toHaveBeenCalledTimes(2);
      expect(leer().auth.fin).toBe("jornada");
    });

    it("al vencer sin franja y sin respuesta, termina por la duración", async () => {
      const reloj = relojFalso();
      const horario = vi.spyOn(auth, "horario").mockRejectedValue(sinConexion());
      vi.spyOn(auth, "me").mockResolvedValue(sesionQueVence("2026-11-17T18:00:00-03:00", 60));
      const leer = await montar(reloj);
      await avanzar(MINUTO, reloj);
      expect(horario).toHaveBeenCalledTimes(2);
      expect(leer().auth.fin).toBe("duracion");
    });

    it("sin sesión no avisa ni termina nada", async () => {
      const reloj = relojFalso();
      servidor("2026-11-17T17:20:00Z", reloj);
      vi.spyOn(auth, "me").mockRejectedValue(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
      const leer = await montar(reloj);
      await avanzar(MINUTO, reloj);
      expect(leer().vencimiento.aviso).toBeNull();
      expect(leer().auth.fin).toBeNull();
    });
  });
});
