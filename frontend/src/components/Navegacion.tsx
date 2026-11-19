import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { destinoSeccion, seccionActiva, seccionesVisibles } from "../utils/secciones";
import styles from "./Navegacion.module.css";

export interface PropsNavegacion {
  etiqueta?: string;
}

export function Navegacion({ etiqueta = "Secciones" }: PropsNavegacion) {
  const { puede } = useAuth();
  const { pathname, search } = useLocation();
  const activa = seccionActiva(pathname);
  return (
    <nav aria-label={etiqueta} className={styles.capsula}>
      <ul className={styles.lista}>
        {seccionesVisibles(puede).map((seccion) => {
          const destino = destinoSeccion(seccion, { pathname, search });
          return (
            <li key={seccion.id}>
              <Link
                to={destino.ruta}
                state={destino.estado}
                className={styles.enlace}
                aria-current={seccion.id === activa ? "page" : undefined}
              >
                {seccion.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
