import type { Prioridad } from "../api/types";
import { MARCA_PRIORIDAD, NOMBRE_PRIORIDAD } from "../utils/presentacion";
import styles from "./MarcaPrioridad.module.css";

export interface PropsMarcaPrioridad {
  prioridad: Prioridad;
  conNombre?: boolean;
}

export function MarcaPrioridad({ prioridad, conNombre = false }: PropsMarcaPrioridad) {
  const marca = MARCA_PRIORIDAD[prioridad];
  return (
    <span className={styles.prioridad} data-prioridad={prioridad}>
      {marca !== "" && (
        <span className={styles.marca} aria-hidden="true">
          {marca}
        </span>
      )}
      <span className={styles.nombre} data-oculto={conNombre ? undefined : "true"}>
        {NOMBRE_PRIORIDAD[prioridad]}
      </span>
    </span>
  );
}
