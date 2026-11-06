import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EVENTO_SESION_CAIDA } from "../api/client";
import { auth } from "../api/endpoints";
import type { Me, Permiso } from "../api/types";

interface ValorAuth {
  me: Me | null;
  cargando: boolean;
  motivoSalida: string | null;
  iniciarSesion: (usuario: string, password: string) => Promise<Me>;
  cerrarSesion: (motivo?: string) => Promise<void>;
  puede: (permiso: Permiso) => boolean;
}

const ContextoAuth = createContext<ValorAuth | null>(null);

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [cargando, setCargando] = useState(true);
  const [motivoSalida, setMotivoSalida] = useState<string | null>(null);

  useEffect(() => {
    auth
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const alCaer = (e: Event) => {
      const detalle = (e as CustomEvent<{ detalle: string }>).detail?.detalle;
      setMe(null);
      setMotivoSalida(detalle ?? "La sesión terminó.");
    };
    window.addEventListener(EVENTO_SESION_CAIDA, alCaer);
    return () => window.removeEventListener(EVENTO_SESION_CAIDA, alCaer);
  }, []);

  const iniciarSesion = useCallback(async (usuario: string, password: string) => {
    const datos = await auth.login(usuario, password);
    setMotivoSalida(null);
    setMe(datos);
    return datos;
  }, []);

  const cerrarSesion = useCallback(async (motivo?: string) => {
    await auth.logout().catch(() => undefined);
    setMe(null);
    setMotivoSalida(motivo ?? null);
  }, []);

  const puede = useCallback((permiso: Permiso) => me?.permisos.includes(permiso) ?? false, [me]);

  const valor = useMemo(
    () => ({ me, cargando, motivoSalida, iniciarSesion, cerrarSesion, puede }),
    [me, cargando, motivoSalida, iniciarSesion, cerrarSesion, puede],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error("useAuth debe usarse dentro de <ProveedorAuth>");
  return valor;
}
