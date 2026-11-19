import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tickets } from "../api/endpoints";
import type { Filtros, Pagina } from "../api/types";
import { POR_PAGINA } from "./bandeja";

export const INTERVALO_BANDEJA_MS = 300_000;

export interface EstadoBandeja {
  pagina: Pagina | null;
  fallo: boolean;
  cargando: boolean;
  recargar: () => void;
}

interface Respuesta {
  pagina: Pagina | null;
  fallo: boolean;
}

export function useBandeja(filtros: Filtros, pagina: number, pausado = false): EstadoBandeja {
  const [respuesta, setRespuesta] = useState<Respuesta>({ pagina: null, fallo: false });
  const [cargando, setCargando] = useState(true);
  const idConsulta = useRef(0);
  // Los filtros llegan como objeto nuevo en cada render: la clave evita pedir de nuevo si no cambió nada.
  const clave = JSON.stringify(filtros);
  const consulta = useMemo(() => JSON.parse(clave) as Filtros, [clave]);

  const pedir = useCallback(async () => {
    const id = ++idConsulta.current;
    setCargando(true);
    try {
      const recibida = await tickets.listar(consulta, pagina, POR_PAGINA);
      if (id === idConsulta.current) setRespuesta({ pagina: recibida, fallo: false });
    } catch {
      if (id === idConsulta.current) setRespuesta({ pagina: null, fallo: true });
    } finally {
      if (id === idConsulta.current) setCargando(false);
    }
  }, [consulta, pagina]);

  useEffect(() => {
    if (pausado) return;
    void pedir();
  }, [pedir, pausado]);

  useEffect(() => {
    if (pausado) return;
    const recarga = setInterval(() => void pedir(), INTERVALO_BANDEJA_MS);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void pedir();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearInterval(recarga);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [pedir, pausado]);

  useEffect(
    () => () => {
      // Una respuesta que llega después de desmontar no tiene a quién avisarle.
      idConsulta.current++;
    },
    [],
  );

  const recargar = useCallback(() => void pedir(), [pedir]);

  return { pagina: respuesta.pagina, fallo: respuesta.fallo, cargando, recargar };
}
