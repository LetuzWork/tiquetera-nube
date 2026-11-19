import { iniciales } from "../utils/presentacion";
import styles from "./Avatar.module.css";

export type VarianteAvatar = "cielo" | "claro";

export interface PropsAvatar {
  nombre: string;
  variante?: VarianteAvatar;
}

export function Avatar({ nombre, variante = "cielo" }: PropsAvatar) {
  return (
    <span className={styles.avatar} data-variante={variante} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
