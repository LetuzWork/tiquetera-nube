import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, EVENTO_SESION_CAIDA } from "../api/client";
import { auth, tickets } from "../api/endpoints";
import type { Me } from "../api/types";
import { meDe } from "../test/fabricas";
import { relojFalso, type RelojFalso } from "../test/tiempo";
import { ProveedorAuth, useAuth, type ValorAuth } from "./AuthContext";

const FUERA_DE_HORARIO = { codigo: "SESION_FUERA_DE_HORARIO", detalle: "La franja horaria cerró y la sesión caducó." };
const SESION_INVALIDA = { codigo: "SESION_INVALIDA", detalle: "La sesión no es válida o expiró." };

async function montar(reloj: RelojFalso = relojFalso()) {
  const ultimo: { valor: ValorAuth | null } = { valor: null };
  function Sonda() {
    ultimo.valor = useAuth();
    return null;
  }
  await act(async () => {
    render(
      <ProveedorAuth relojMonotono={reloj.ahora}>
        <Sonda />
      </ProveedorAuth>,
    );
  });
  return () => {
    if (!ultimo.valor) throw new Error("La sonda no se montó");
    return ultimo.valor;
  };
}

async function caer(caida: { codigo: string; detalle: string }) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA, { detail: caida }));
  });
}

function conSesion(me: Me = meDe("operador")) {
  vi.spyOn(auth, "me").mockResolvedValue(me);
  return me;
}

describe("ProveedorAuth", () => {
  it("guarda la marca monotónica en que llegó la sesión", async () => {
    const me = conSesion();
    const valor = await montar(relojFalso(5_000));
    expect(valor().me).toEqual(me);
    expect(valor().cargando).toBe(false);
    expect(valor().recibidoEn).toBe(5_000);
    expect(valor().fin).toBeNull();
  });

  describe("RF-22: rechazo por horario", () => {
    it("SESION_FUERA_DE_HORARIO marca fin = jornada y conserva me", async () => {
      const me = conSesion();
      const valor = await montar();
      await caer(FUERA_DE_HORARIO);
      expect(valor().fin).toBe("jornada");
      expect(valor().me).toEqual(me);
      expect(valor().motivoSalida).toBeNull();
    });

    it("un 401 por horario real, vía fetch, también marca el fin", async () => {
      conSesion();
      const valor = await montar();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(FUERA_DE_HORARIO), { status: 401 }));
      await act(async () => {
        await tickets.obtener(45).catch(() => undefined);
      });
      expect(valor().fin).toBe("jornada");
      expect(valor().me).not.toBeNull();
    });

    it("terminarSesion marca el fin con su motivo", async () => {
      conSesion();
      const valor = await montar();
      await act(async () => {
        valor().terminarSesion("duracion");
      });
      expect(valor().fin).toBe("duracion");
      expect(valor().me).not.toBeNull();
    });
  });

  describe("RF-23: sesión no válida", () => {
    it("SESION_INVALIDA deja me en null con el motivo del servidor", async () => {
      conSesion();
      const valor = await montar();
      await caer(SESION_INVALIDA);
      expect(valor().me).toBeNull();
      expect(valor().motivoSalida).toBe("La sesión no es válida o expiró.");
      expect(valor().fin).toBeNull();
    });

    it("un 401 inicial en /auth/me deja la sesión vacía y sin motivo", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(SESION_INVALIDA), { status: 401 }));
      const valor = await montar();
      expect(valor().cargando).toBe(false);
      expect(valor().me).toBeNull();
      expect(valor().motivoSalida).toBeNull();
    });

    it("con fin marcado ignora las caídas siguientes", async () => {
      const me = conSesion();
      const valor = await montar();
      await caer(FUERA_DE_HORARIO);
      await caer(SESION_INVALIDA);
      await act(async () => {
        valor().terminarSesion("duracion");
      });
      expect(valor().fin).toBe("jornada");
      expect(valor().me).toEqual(me);
      expect(valor().motivoSalida).toBeNull();
    });
  });

  describe("fin vuelve a null (hallazgo 2)", () => {
    it("con cerrarSesion", async () => {
      conSesion();
      vi.spyOn(auth, "logout").mockResolvedValue(undefined);
      const valor = await montar();
      await caer(FUERA_DE_HORARIO);
      await act(async () => {
        await valor().cerrarSesion("La jornada terminó.");
      });
      expect(valor().fin).toBeNull();
      expect(valor().me).toBeNull();
      expect(valor().motivoSalida).toBe("La jornada terminó.");
    });

    it("con iniciarSesion, que recibe la señal y renueva la marca", async () => {
      conSesion();
      const reloj = relojFalso(1_000);
      const valor = await montar(reloj);
      await caer(FUERA_DE_HORARIO);
      const nueva = meDe("operador", { sesion_expira: "2026-11-18T09:00:00-03:00" });
      const login = vi.spyOn(auth, "login").mockResolvedValue(nueva);
      const control = new AbortController();
      reloj.mover(60_000);
      await act(async () => {
        await valor().iniciarSesion("u.operador", "secreta", control.signal);
      });
      expect(login).toHaveBeenCalledWith("u.operador", "secreta", control.signal);
      expect(valor().fin).toBeNull();
      expect(valor().me).toEqual(nueva);
      expect(valor().motivoSalida).toBeNull();
      expect(valor().recibidoEn).toBe(61_000);
    });

    it("después de un nuevo ingreso, un rechazo por horario vuelve a marcar el fin", async () => {
      conSesion();
      vi.spyOn(auth, "logout").mockResolvedValue(undefined);
      vi.spyOn(auth, "login").mockResolvedValue(meDe("operador"));
      const valor = await montar();
      await caer(FUERA_DE_HORARIO);
      await act(async () => {
        await valor().cerrarSesion("La jornada terminó.");
      });
      await act(async () => {
        await valor().iniciarSesion("u.operador", "secreta");
      });
      await caer(FUERA_DE_HORARIO);
      expect(valor().fin).toBe("jornada");
    });

    describe("D-28: ingreso antes de que responda /auth/me", () => {
      function meQueTarda() {
        const pendiente: { responder?: (me: Me) => void; rechazar?: (error: unknown) => void } = {};
        vi.spyOn(auth, "me").mockReturnValue(
          new Promise<Me>((responder, rechazar) => {
            pendiente.responder = responder;
            pendiente.rechazar = rechazar;
          }),
        );
        return pendiente;
      }

      async function ingresarMientrasComprueba(reloj: RelojFalso) {
        const nueva = meDe("operador", { sesion_expira: "2026-11-18T09:00:00-03:00" });
        vi.spyOn(auth, "login").mockResolvedValue(nueva);
        const valor = await montar(reloj);
        expect(valor().cargando).toBe(true);
        reloj.mover(1_000);
        await act(async () => {
          await valor().iniciarSesion("u.operador", "secreta");
        });
        expect(valor().me).toEqual(nueva);
        expect(valor().cargando).toBe(false);
        return { valor, nueva };
      }

      it("un 401 tardío no saca a quien ya ingresó", async () => {
        const pendiente = meQueTarda();
        const reloj = relojFalso(5_000);
        const { valor, nueva } = await ingresarMientrasComprueba(reloj);
        reloj.mover(1_000);
        await act(async () => {
          pendiente.rechazar?.(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
        });
        expect(valor().me).toEqual(nueva);
        expect(valor().recibidoEn).toBe(6_000);
        expect(valor().motivoSalida).toBeNull();
        expect(valor().cargando).toBe(false);
      });

      it("datos viejos tardíos no pisan la sesión nueva", async () => {
        const pendiente = meQueTarda();
        const reloj = relojFalso(5_000);
        const { valor, nueva } = await ingresarMientrasComprueba(reloj);
        reloj.mover(1_000);
        await act(async () => {
          pendiente.responder?.(meDe("consulta"));
        });
        expect(valor().me).toEqual(nueva);
        expect(valor().recibidoEn).toBe(6_000);
        expect(valor().cargando).toBe(false);
      });

      it("sin ingreso, la respuesta de /auth/me sigue valiendo", async () => {
        const pendiente = meQueTarda();
        const valor = await montar(relojFalso(5_000));
        const vieja = meDe("consulta");
        await act(async () => {
          pendiente.responder?.(vieja);
        });
        expect(valor().me).toEqual(vieja);
        expect(valor().recibidoEn).toBe(5_000);
        expect(valor().cargando).toBe(false);
      });
    });

    it("un ingreso rechazado no cambia la sesión", async () => {
      vi.spyOn(auth, "me").mockRejectedValue(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
      vi.spyOn(auth, "login").mockRejectedValue(
        new ApiError(401, "CREDENCIALES_INVALIDAS", "Usuario o contraseña incorrectos.", {}),
      );
      const valor = await montar();
      await act(async () => {
        await valor().iniciarSesion("u.operador", "mala").catch(() => undefined);
      });
      expect(valor().me).toBeNull();
      expect(valor().recibidoEn).toBeNull();
    });
  });
});
