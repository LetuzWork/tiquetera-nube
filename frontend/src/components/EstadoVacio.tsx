import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./EstadoVacio.module.css";

export interface PropsEstadoVacio {
  icono: LucideIcon;
  titulo: string;
  accion: ReactNode;
  nivel?: 1 | 2;
}

export function EstadoVacio({ icono: Icono, titulo, accion, nivel = 1 }: PropsEstadoVacio) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <div className={styles.vacio}>
      <Icono className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
      <Titulo className={styles.titulo}>{titulo}</Titulo>
      {accion}
    </div>
  );
}
