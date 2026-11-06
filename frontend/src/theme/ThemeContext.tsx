import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { colores, estados, fuentes, prioridades, type Turno } from "./theme";
import "./tokens.css";

interface ValorTema {
  turno: Turno;
  alternarTurno: () => void;
  fijarTurno: (turno: Turno) => void;
  colores: typeof colores;
  fuentes: typeof fuentes;
  estados: typeof estados;
  prioridades: typeof prioridades;
}

const CLAVE_TURNO = "tq.turno";

const ContextoTema = createContext<ValorTema | null>(null);

const turnoInicial = (): Turno => {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TURNO);
    if (guardado === "dia" || guardado === "noche") return guardado;
  } catch {
    return "dia";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "noche" : "dia";
};

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [turno, setTurno] = useState<Turno>(turnoInicial);

  useEffect(() => {
    document.documentElement.dataset.turno = turno;
    try {
      window.localStorage.setItem(CLAVE_TURNO, turno);
    } catch {
      return;
    }
  }, [turno]);

  const alternarTurno = useCallback(() => setTurno((t) => (t === "dia" ? "noche" : "dia")), []);

  const valor = useMemo<ValorTema>(
    () => ({ turno, alternarTurno, fijarTurno: setTurno, colores, fuentes, estados, prioridades }),
    [turno, alternarTurno],
  );

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error("useTema debe usarse dentro de <ProveedorTema>");
  return valor;
}
