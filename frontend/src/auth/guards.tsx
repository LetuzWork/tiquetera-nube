import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Permiso } from "../api/types";
import { EnlaceBoton } from "../components/Boton";
import { EstadoVacio } from "../components/EstadoVacio";
import { useAuth } from "./AuthContext";

export function RutaProtegida({ children, permiso }: { children: ReactNode; permiso?: Permiso }) {
  const { me, cargando, puede } = useAuth();
  const ubicacion = useLocation();
  if (cargando)
    return (
      <p className="tq-cargando" role="status">
        Verificando tu sesión…
      </p>
    );
  if (!me) return <Navigate to="/ventanilla" replace state={{ desde: ubicacion.pathname }} />;
  if (permiso && !puede(permiso))
    return (
      <EstadoVacio
        icono={Lock}
        titulo="No tenés acceso a esta sección"
        accion={
          <EnlaceBoton to="/bandeja" variante="primario">
            Volver a Tickets
          </EnlaceBoton>
        }
      />
    );
  return <>{children}</>;
}

export function Can({ permiso, children, sino = null }: { permiso: Permiso; children: ReactNode; sino?: ReactNode }) {
  const { puede } = useAuth();
  return <>{puede(permiso) ? children : sino}</>;
}
