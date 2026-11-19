import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { tickets } from "../api/endpoints";
import type { Pagina } from "../api/types";

export const INTERVALO_TICKETS_MS = 300_000;

interface TicketsDeHoy {
  pagina: Pagina | null;
  fallo: boolean;
}

export function useTicketsDeHoy(hoy: string | null, pausado: boolean): TicketsDeHoy {
  const { pathname } = useLocation();
  const [estado, setEstado] = useState<TicketsDeHoy>({ pagina: null, fallo: false });
  const idConsulta = useRef(0);

  const pedir = useCallback(async () => {
    if (hoy === null || pausado) return;
    const id = ++idConsulta.current;
    try {
      const pagina = await tickets.listar({ desde: hoy, hasta: hoy }, 1, 100);
      if (id === idConsulta.current) setEstado({ pagina, fallo: false });
    } catch {
      // RF-13: sin las marcas anteriores, que ya no se sabe si siguen.
      if (id === idConsulta.current) setEstado({ pagina: null, fallo: true });
    }
  }, [hoy, pausado]);

  useEffect(() => {
    void pedir();
  }, [pedir, pathname]);

  useEffect(() => {
    if (hoy === null || pausado) return;
    const recarga = setInterval(() => void pedir(), INTERVALO_TICKETS_MS);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void pedir();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearInterval(recarga);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [pedir, hoy, pausado]);

  return estado;
}
