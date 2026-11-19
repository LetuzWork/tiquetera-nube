import type { Estado } from "../api/types";
import { ETIQUETA_ESTADO } from "../utils/presentacion";
import styles from "./IndicadorEstado.module.css";

export interface PropsIndicadorEstado {
  estado: Estado;
}

export function IndicadorEstado({ estado }: PropsIndicadorEstado) {
  return (
    <span className={styles.indicador} data-estado={estado}>
      <span className={styles.punto} aria-hidden="true" />
      <span className={styles.texto}>{ETIQUETA_ESTADO[estado]}</span>
    </span>
  );
}
