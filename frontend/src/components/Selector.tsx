import { ChevronDown } from "lucide-react";
import { useId, type Ref, type SelectHTMLAttributes } from "react";
import styles from "./Selector.module.css";

export interface OpcionSelector<T extends string> {
  valor: T;
  etiqueta: string;
  deshabilitada?: boolean;
}

export interface PropsSelector<T extends string>
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "className" | "children" | "value" | "defaultValue" | "onChange" | "multiple" | "aria-invalid" | "aria-describedby"
  > {
  etiqueta: string;
  opciones: readonly OpcionSelector<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiquetaOculta?: boolean;
  error?: string | null;
  referencia?: Ref<HTMLSelectElement>;
}

export function Selector<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  etiquetaOculta = false,
  error,
  referencia,
  id,
  ...resto
}: PropsSelector<T>) {
  const generado = useId();
  const idSelector = id ?? generado;
  const idError = `${idSelector}-error`;
  const conError = typeof error === "string" && error !== "";
  return (
    <div className={styles.campo}>
      <label className={styles.etiqueta} htmlFor={idSelector} data-oculta={etiquetaOculta ? "true" : undefined}>
        {etiqueta}
      </label>
      <div className={styles.caja}>
        <select
          {...resto}
          ref={referencia}
          id={idSelector}
          className={styles.selector}
          value={valor}
          aria-invalid={conError ? true : undefined}
          aria-describedby={conError ? idError : undefined}
          onChange={(evento) => {
            const elegida = opciones.find((opcion) => opcion.valor === evento.target.value);
            if (elegida) alCambiar(elegida.valor);
          }}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor} disabled={opcion.deshabilitada}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
      </div>
      {conError && (
        <p id={idError} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
