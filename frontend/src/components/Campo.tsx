import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { largoTexto } from "../utils/presentacion";
import styles from "./Campo.module.css";

export interface PropsCampo
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "aria-invalid" | "aria-describedby"> {
  etiqueta: string;
  error?: string | null;
  contador?: boolean;
}

export const Campo = forwardRef<HTMLInputElement, PropsCampo>(function Campo(
  { etiqueta, error, contador = false, id, ...resto },
  referencia,
) {
  const generado = useId();
  const idEntrada = id ?? generado;
  const idError = `${idEntrada}-error`;
  const idContador = `${idEntrada}-contador`;
  const conError = typeof error === "string" && error !== "";
  const conContador = contador && resto.maxLength !== undefined;
  const largo = largoTexto(String(resto.value ?? ""));
  const descripcion = [conError ? idError : null, conContador ? idContador : null].filter(Boolean).join(" ");
  return (
    <div className={styles.campo}>
      <label className={styles.etiqueta} htmlFor={idEntrada}>
        {etiqueta}
      </label>
      <input
        {...resto}
        ref={referencia}
        id={idEntrada}
        className={styles.entrada}
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
