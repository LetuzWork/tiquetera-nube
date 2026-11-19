import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import styles from "./Boton.module.css";

export type VarianteBoton = "primario" | "secundario" | "simple" | "peligro";

export interface PropsBoton extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variante?: VarianteBoton;
  anchoCompleto?: boolean;
  cargando?: boolean;
  textoCargando?: string;
}

export const Boton = forwardRef<HTMLButtonElement, PropsBoton>(function Boton(
  { variante = "primario", anchoCompleto = false, cargando = false, textoCargando, disabled, type = "button", children, ...resto },
  referencia,
) {
  return (
    <button
      {...resto}
      ref={referencia}
      type={type}
      className={styles.boton}
      data-variante={variante}
      data-ancho={anchoCompleto ? "completo" : undefined}
      data-cargando={cargando ? "true" : undefined}
      disabled={disabled === true || cargando}
    >
      {cargando && textoCargando !== undefined ? textoCargando : children}
    </button>
  );
});

export interface PropsEnlaceBoton extends Omit<LinkProps, "className"> {
  variante?: VarianteBoton;
}

export function EnlaceBoton({ variante = "primario", ...resto }: PropsEnlaceBoton) {
  return <Link {...resto} className={styles.boton} data-variante={variante} />;
}
