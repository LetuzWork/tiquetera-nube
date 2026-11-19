import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Aviso.module.css";

export interface PropsAviso {
  children?: ReactNode;
  abierto?: boolean;
  alCerrar: () => void;
}

export function Aviso({ children, abierto = true, alCerrar }: PropsAviso) {
  return (
    <div className={styles.aviso} data-abierto={abierto}>
      <p role="status" className={styles.texto}>
        {abierto ? children : null}
      </p>
      {abierto && (
        <button type="button" className={styles.cerrar} aria-label="Cerrar aviso" onClick={alCerrar}>
          <X className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
