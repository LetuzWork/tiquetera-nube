import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { Horario } from "../api/types";
import { instanteDe } from "../utils/zona";

export interface RelojFalso {
  ahora: () => number;
  mover: (ms: number) => void;
}

export function relojFalso(inicio = 0): RelojFalso {
  let marca = inicio;
  return {
    ahora: () => marca,
    mover: (ms: number) => {
      marca += ms;
    },
  };
}

export async function avanzar(ms: number, reloj: RelojFalso): Promise<void> {
  await act(async () => {
    reloj.mover(ms);
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export function horarioQueAvanza(horario: Horario, reloj: RelojFalso): () => Promise<Horario> {
  const marcaInicial = reloj.ahora();
  const instanteInicial = instanteDe(horario.ahora);
  return async () => ({ ...horario, ahora: new Date(instanteInicial + reloj.ahora() - marcaInicial).toISOString() });
}

export async function cambiarVisibilidad(estado: DocumentVisibilityState): Promise<void> {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(estado);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
