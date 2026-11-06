import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Permiso } from "../api/types";
import { Prohibido } from "../components/Prohibido";
import { useAuth } from "./AuthContext";

export function RutaProtegida({ children, permiso }: { children: ReactNode; permiso?: Permiso }) {
  const { me, cargando, puede } = useAuth();
  const ubicacion = useLocation();
  if (cargando) return <p className="cargando">Buscando tu credencial…</p>;
  if (!me) return <Navigate to="/ventanilla" replace state={{ desde: ubicacion.pathname }} />;
  if (permiso && !puede(permiso)) return <Prohibido detalle="Tu rol no tiene acceso a esta sección." />;
  return <>{children}</>;
}

export function Can({ permiso, children, sino = null }: { permiso: Permiso; children: ReactNode; sino?: ReactNode }) {
  const { puede } = useAuth();
  return <>{puede(permiso) ? children : sino}</>;
}
