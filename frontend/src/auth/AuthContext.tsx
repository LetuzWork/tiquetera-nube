import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EVENTO_SESION_CAIDA } from "../api/client";
import { auth } from "../api/endpoints";
import type { Me, Permiso } from "../api/types";
import { accionAnteCaida } from "./caida";
import type { MotivoFin } from "./sesion";

export interface ValorAuth {
  me: Me | null;
  cargando: boolean;
  motivoSalida: string | null;
  recibidoEn: number | null;
  fin: MotivoFin | null;
  relojMonotono: () => number;
  iniciarSesion: (usuario: string, password: string, senal?: AbortSignal) => Promise<Me>;
  cerrarSesion: (motivo?: string) => Promise<void>;
  terminarSesion: (motivo: MotivoFin) => void;
  puede: (permiso: Permiso) => boolean;
}

const ContextoAuth = createContext<ValorAuth | null>(null);

const relojPorOmision = () => performance.now();

export function ProveedorAuth({
  children,
  relojMonotono = relojPorOmision,
}: {
  children: ReactNode;
  relojMonotono?: () => number;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [cargando, setCargando] = useState(true);
  const [motivoSalida, setMotivoSalida] = useState<string | null>(null);
  const [recibidoEn, setRecibidoEn] = useState<number | null>(null);
  const [fin, setFin] = useState<MotivoFin | null>(null);
  // Copia síncrona de fin: dos caídas seguidas llegan antes de que React vuelva a renderizar.
  const finActual = useRef<MotivoFin | null>(null);
  // D-28: ingresar, salir o una caída deciden la sesión, y un /auth/me que responde después no los pisa.
  const cambiosDeSesion = useRef(0);

  const fijarFin = useCallback((motivo: MotivoFin | null) => {
    finActual.current = motivo;
    setFin(motivo);
  }, []);

  const terminarSesion = useCallback(
    (motivo: MotivoFin) => {
      if (finActual.current === null) fijarFin(motivo);
    },
    [fijarFin],
  );

  useEffect(() => {
    const alPedir = cambiosDeSesion.current;
    const vigente = () => cambiosDeSesion.current === alPedir;
    auth
      .me()
      .then((datos) => {
        if (!vigente()) return;
        setMe(datos);
        setRecibidoEn(relojMonotono());
      })
      .catch(() => {
        if (vigente()) setMe(null);
      })
      .finally(() => setCargando(false));
  }, [relojMonotono]);

  useEffect(() => {
    const alCaer = (e: Event) => {
      const { codigo, detalle } = (e as CustomEvent<{ codigo?: string; detalle?: string }>).detail ?? {};
      const accion = accionAnteCaida(codigo ?? "", { fin: finActual.current });
      if (accion === "ignorar") return;
      if (accion === "fin-jornada") {
        terminarSesion("jornada");
        return;
      }
      cambiosDeSesion.current++;
      setMe(null);
      setRecibidoEn(null);
      setMotivoSalida(detalle ?? "La sesión terminó.");
    };
    window.addEventListener(EVENTO_SESION_CAIDA, alCaer);
    return () => window.removeEventListener(EVENTO_SESION_CAIDA, alCaer);
  }, [terminarSesion]);

  const iniciarSesion = useCallback(
    async (usuario: string, password: string, senal?: AbortSignal) => {
      const datos = await auth.login(usuario, password, senal);
      cambiosDeSesion.current++;
      fijarFin(null);
      setMotivoSalida(null);
      setMe(datos);
      setRecibidoEn(relojMonotono());
      setCargando(false);
      return datos;
    },
    [fijarFin, relojMonotono],
  );

  const cerrarSesion = useCallback(
    async (motivo?: string) => {
      await auth.logout().catch(() => undefined);
      cambiosDeSesion.current++;
      fijarFin(null);
      setMe(null);
      setRecibidoEn(null);
      setMotivoSalida(motivo ?? null);
    },
    [fijarFin],
  );

  const puede = useCallback((permiso: Permiso) => me?.permisos.includes(permiso) ?? false, [me]);

  const valor = useMemo<ValorAuth>(
    () => ({
      me,
      cargando,
      motivoSalida,
      recibidoEn,
      fin,
      relojMonotono,
      iniciarSesion,
      cerrarSesion,
      terminarSesion,
      puede,
    }),
    [me, cargando, motivoSalida, recibidoEn, fin, relojMonotono, iniciarSesion, cerrarSesion, terminarSesion, puede],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error("useAuth debe usarse dentro de <ProveedorAuth>");
  return valor;
}
