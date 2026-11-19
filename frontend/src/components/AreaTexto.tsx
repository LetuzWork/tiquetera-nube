import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { largoTexto } from "../utils/presentacion";
import styles from "./AreaTexto.module.css";

export interface PropsAreaTexto
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "aria-invalid" | "aria-describedby"> {
  etiqueta: string;
  error?: string | null;
  contador?: boolean;
  etiquetaOculta?: boolean;
}

export const AreaTexto = forwardRef<HTMLTextAreaElement, PropsAreaTexto>(function AreaTexto(
  { etiqueta, error, contador = false, etiquetaOculta = false, id, rows = 5, ...resto },
  referencia,
) {
  const generado = useId();
  const idArea = id ?? generado;
  const idError = `${idArea}-error`;
  const idContador = `${idArea}-contador`;
  const conError = typeof error === "string" && error !== "";
  const conContador = contador && resto.maxLength !== undefined;
  const largo = largoTexto(String(resto.value ?? ""));
  const descripcion = [conError ? idError : null, conContador ? idContador : null].filter(Boolean).join(" ");
  return (
    <div className={styles.campo}>
      <label className={styles.etiqueta} htmlFor={idArea} data-oculta={etiquetaOculta ? "true" : undefined}>
        {etiqueta}
      </label>
      <textarea
        {...resto}
        ref={referencia}
        id={idArea}
        rows={rows}
        className={styles.area}
        aria-invalid={conError ? true : undefined}
        aria-describedby={descripcion !== "" ? descripcion : undefined}
      />
      {(conError || conContador) && (
        <div className={styles.pie}>
          {conError && (
            <p id={idError} className={styles.error}>
              {error}
            </p>
          )}
          {conContador && (
            <p
              id={idContador}
              className={styles.contador}
              data-excedido={resto.maxLength !== undefined && largo > resto.maxLength ? "true" : undefined}
            >
              {largo}/{resto.maxLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
