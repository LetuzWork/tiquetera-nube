import { act, renderHook, type RenderHookResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { auth, usuarios } from "../api/endpoints";
import type { Me, Persona, Rol } from "../api/types";
import { ProveedorAuth, useAuth, type ValorAuth } from "../auth/AuthContext";
import { meDe } from "../test/fabricas";
import { useResponsables } from "./useResponsables";

const RESPONSABLES: Persona[] = [
  { usuario: "u.admin", nombre: "Ana Administradora" },
  { usuario: "u.operador", nombre: "Omar Operador" },
];

interface Lectura {
  responsables: Persona[];
  auth: ValorAuth;
}

const sesionInvalida = () => new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {});

function Proveedor({ children }: { children: ReactNode }) {
  return <ProveedorAuth>{children}</ProveedorAuth>;
}

async function montar(me: Me | null) {
  if (me) vi.spyOn(auth, "me").mockResolvedValue(me);
  else vi.spyOn(auth, "me").mockRejectedValue(sesionInvalida());
  let montado: RenderHookResult<Lectura, unknown> | undefined;
  await act(async () => {
    montado = renderHook((): Lectura => ({ responsables: useResponsables(), auth: useAuth() }), { wrapper: Proveedor });
  });
  if (!montado) throw new Error("No se montó el hook");
  return montado;
}

describe("useResponsables", () => {
  it.each<Rol>(["admin", "operador"])("con ticket:asignar (%s) pide la lista una vez y la devuelve", async (rol) => {
    const responsables = vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
    const { result } = await montar(meDe(rol));
    expect(responsables).toHaveBeenCalledTimes(1);
    expect(result.current.responsables).toEqual(RESPONSABLES);
  });

  it.each<Rol>(["usuario", "consulta"])("sin ticket:asignar (%s) no pide nada y devuelve una lista vacía", async (rol) => {
    const responsables = vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
    const { result } = await montar(meDe(rol));
    expect(responsables).not.toHaveBeenCalled();
    expect(result.current.responsables).toEqual([]);
  });

  it("sin sesión no pide nada y devuelve una lista vacía", async () => {
    const responsables = vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
    const { result } = await montar(null);
    expect(responsables).not.toHaveBeenCalled();
    expect(result.current.responsables).toEqual([]);
  });

  it("si el pedido falla, devuelve una lista vacía", async () => {
    const responsables = vi
      .spyOn(usuarios, "responsables")
      .mockRejectedValue(new ApiError(403, "PERMISO_DENEGADO", "No tenés permiso para esta acción.", {}));
    const { result } = await montar(meDe("operador"));
    expect(responsables).toHaveBeenCalledTimes(1);
    expect(result.current.responsables).toEqual([]);
  });

  it("al cerrar la sesión deja de devolver la lista", async () => {
    vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
    vi.spyOn(auth, "logout").mockResolvedValue(undefined);
    const { result } = await montar(meDe("operador"));
    expect(result.current.responsables).toEqual(RESPONSABLES);
    await act(async () => {
      await result.current.auth.cerrarSesion();
    });
    expect(result.current.responsables).toEqual([]);
  });

  it("al ingresar con ticket:asignar, recién entonces pide la lista", async () => {
    const responsables = vi.spyOn(usuarios, "responsables").mockResolvedValue(RESPONSABLES);
    vi.spyOn(auth, "login").mockResolvedValue(meDe("admin"));
    const { result } = await montar(null);
    expect(responsables).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.auth.iniciarSesion("u.admin", "secreta");
    });
    expect(responsables).toHaveBeenCalledTimes(1);
    expect(result.current.responsables).toEqual(RESPONSABLES);
  });
});
