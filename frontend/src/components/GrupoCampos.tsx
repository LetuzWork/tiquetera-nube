import type { ReactNode } from "react";
import styles from "./GrupoCampos.module.css";

export interface PropsGrupoCampos {
  leyenda: string;
  leyendaOculta?: boolean;
  sacudidas?: number;
  children: ReactNode;
}

export function GrupoCampos({ leyenda, leyendaOculta = false, sacudidas = 0, children }: PropsGrupoCampos) {
  // Pasar de par a impar cambia el nombre de la animación, y eso la vuelve a disparar sin remontar los campos.
  const vuelta = sacudidas % 2 === 0 ? "par" : "impar";
  return (
    <fieldset className={styles.grupo} data-sacudir={sacudidas > 0 ? "true" : "false"} data-vuelta={vuelta}>
      <legend className={styles.leyenda} data-oculta={leyendaOculta ? "true" : undefined}>
        {leyenda}
      </legend>
      <div className={styles.filas}>{children}</div>
    </fieldset>
  );
}
