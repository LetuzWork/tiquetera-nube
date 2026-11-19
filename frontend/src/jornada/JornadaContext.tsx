import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { auth } from "../api/endpoints";
import type { Horario } from "../api/types";
import { instanteDe, ZONA_RESPALDO } from "../utils/zona";
import { cieloDe, type ColoresCielo } from "./cielo";
import { calcularJornada, type Jornada } from "./jornada";
import { horaDelServidor, medirDesfase } from "./relojServidor";

export const INTERVALO_TIC_MS = 30_000;
export const INTERVALO_FRANJA_MS = 300_000;

export interface ValorJornada {
  horario: Horario | null;
  sinFranja: boolean;
  ahora: number | null;
  jornada: Jornada | null;
  cielo: ColoresCielo | null;
  zona: string;
  actualizar: () => Promise<Horario | null>;
}

const ContextoJornada = createContext<ValorJornada | null>(null);

const relojPorOmision = () => performance.now();

export function ProveedorJornada({
  children,
  relojMonotono = relojPorOmision,
}: {
  children: ReactNode;
  relojMonotono?: () => number;
}) {
  const [horario, setHorario] = useState<Horario | null>(null);
  const [sinFranja, setSinFranja] = useState(false);
  const [ahora, setAhora] = useState<number | null>(null);
  const desfase = useRef<number | null>(null);
  const ultimaFranja = useRef<Horario | null>(null);
  const idConsulta = useRef(0);
  const cerradaPrevia = useRef<boolean | null>(null);

  const actualizar = useCallback(async (): Promise<Horario | null> => {
    const id = ++idConsulta.current;
    const antes = relojMonotono();
    let recibido: Horario;
    try {
      recibido = await auth.horario();
    } catch {
      // RF-9: con una franja previa no cambia nada y se reintenta en el ciclo siguiente.
      if (id === idConsulta.current && ultimaFranja.current === null) setSinFranja(true);
      return ultimaFranja.current;
    }
    if (id !== idConsulta.current) return ultimaFranja.current;
    const despues = relojMonotono();
    const medido = medirDesfase(instanteDe(recibido.ahora), antes, despues);
    desfase.current = medido;
    ultimaFranja.current = recibido;
    setHorario(recibido);
    setSinFranja(false);
    setAhora(horaDelServidor(medido, relojMonotono()));
    return recibido;
  }, [relojMonotono]);

  const tic = useCallback(() => {
    if (desfase.current !== null) setAhora(horaDelServidor(desfase.current, relojMonotono()));
  }, [relojMonotono]);

  useEffect(() => {
    void actualizar();
    const ticTac = setInterval(tic, INTERVALO_TIC_MS);
    const recarga = setInterval(() => void actualizar(), INTERVALO_FRANJA_MS);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== "visible") return;
      tic();
      void actualizar();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearInterval(ticTac);
      clearInterval(recarga);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [actualizar, tic]);

  const jornada = useMemo(() => (horario && ahora !== null ? calcularJornada(horario, ahora) : null), [horario, ahora]);
  const cerrada = jornada === null ? null : jornada.estado === "cerrada";

  useEffect(() => {
    if (cerrada === null) return;
    const previa = cerradaPrevia.current;
    cerradaPrevia.current = cerrada;
    if (previa !== null && previa !== cerrada) void actualizar();
  }, [cerrada, actualizar]);

  const valor = useMemo<ValorJornada>(
    () => ({
      horario,
      sinFranja,
      ahora,
      jornada,
      cielo: cieloDe(horario, jornada, sinFranja),
      zona: horario?.zona ?? ZONA_RESPALDO,
      actualizar,
    }),
    [horario, sinFranja, ahora, jornada, actualizar],
  );

  return <ContextoJornada.Provider value={valor}>{children}</ContextoJornada.Provider>;
}

export function useJornada(): ValorJornada {
  const valor = useContext(ContextoJornada);
  if (!valor) throw new Error("useJornada debe usarse dentro de <ProveedorJornada>");
  return valor;
}
