import { act, render, type RenderResult } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { vi } from "vitest";
import { App } from "../App";
import { ApiError } from "../api/client";
import { auth, demo, tickets } from "../api/endpoints";
import type { Horario, Me } from "../api/types";
import { horarioDe, paginaDe } from "./fabricas";
import { horarioQueAvanza, relojFalso, type RelojFalso } from "./tiempo";

export const AHORA_PRUEBA = "2026-11-17T17:20:00Z";

export interface OpcionesApp {
  ruta: string;
  me?: Me | null;
  horario?: Horario | null;
  reloj?: RelojFalso;
}

export interface AppRenderizada extends RenderResult {
  reloj: RelojFalso;
}

export async function renderizarApp({ ruta, me = null, horario, reloj = relojFalso() }: OpcionesApp): Promise<AppRenderizada> {
  if (!vi.isMockFunction(auth.me)) {
    const espia = vi.spyOn(auth, "me");
    if (me) espia.mockResolvedValue(me);
    else espia.mockRejectedValue(new ApiError(401, "SESION_INVALIDA", "La sesión no es válida o expiró.", {}));
  }
  if (!vi.isMockFunction(auth.horario)) {
    const espia = vi.spyOn(auth, "horario");
    if (horario === null) espia.mockRejectedValue(new ApiError(0, "SIN_CONEXION", "No se pudo contactar al servidor.", {}));
    else espia.mockImplementation(horarioQueAvanza(horario ?? horarioDe(AHORA_PRUEBA), reloj));
  }
  if (!vi.isMockFunction(tickets.listar)) vi.spyOn(tickets, "listar").mockResolvedValue(paginaDe([]));
  if (!vi.isMockFunction(demo.reloj)) {
    vi.spyOn(demo, "reloj").mockRejectedValue(new ApiError(404, "ERROR", "Not Found", {}));
  }
  window.history.pushState({}, "", ruta);
  let resultado: RenderResult | undefined;
  await act(async () => {
    resultado = render(<App relojMonotono={reloj.ahora} />);
  });
  if (!resultado) throw new Error("No se pudo montar la app");
  return Object.assign(resultado, { reloj });
}

export function SondaRuta() {
  const ubicacion = useLocation();
  const estado = ubicacion.state as { desde?: unknown } | null;
  const desde = typeof estado?.desde === "string" ? estado.desde : "";
  return (
    <output aria-label="Ruta actual" data-ruta={ubicacion.pathname} data-desde={desde}>
      {ubicacion.pathname}
    </output>
  );
}
