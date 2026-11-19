import { useId, useRef, type KeyboardEvent } from "react";
import styles from "./Segmentado.module.css";

export interface OpcionSegmentado<T extends string> {
  valor: T;
  etiqueta: string;
}

export interface PropsSegmentado<T extends string> {
  etiqueta: string;
  opciones: readonly OpcionSegmentado<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiquetaVisible?: boolean;
  deshabilitado?: boolean;
  anchoCompleto?: boolean;
}

const ANTERIOR = new Set(["ArrowLeft", "ArrowUp"]);
const SIGUIENTE = new Set(["ArrowRight", "ArrowDown"]);

export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  etiquetaVisible = false,
  deshabilitado = false,
  anchoCompleto = false,
}: PropsSegmentado<T>) {
  const idEtiqueta = `${useId()}-etiqueta`;
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const elegido = opciones.findIndex((opcion) => opcion.valor === valor);
  const conFoco = elegido >= 0 ? elegido : 0;

  function elegir(indice: number) {
    const opcion = opciones[indice];
    if (!opcion) return;
    botones.current[indice]?.focus();
    if (opcion.valor !== valor) alCambiar(opcion.valor);
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const total = opciones.length;
    if (total === 0 || deshabilitado) return;
    const actual = botones.current.findIndex((boton) => boton === evento.target);
    const desde = actual >= 0 ? actual : conFoco;
    let destino: number | null = null;
    if (ANTERIOR.has(evento.key)) destino = (desde - 1 + total) % total;
    else if (SIGUIENTE.has(evento.key)) destino = (desde + 1) % total;
    else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = total - 1;
    if (destino === null) return;
    evento.preventDefault();
    elegir(destino);
  }

  const grupo = (
    <div
      role="radiogroup"
      aria-label={etiquetaVisible ? undefined : etiqueta}
      aria-labelledby={etiquetaVisible ? idEtiqueta : undefined}
      aria-disabled={deshabilitado ? true : undefined}
      className={styles.grupo}
      data-ancho={anchoCompleto ? "completo" : undefined}
      onKeyDown={alTeclear}
    >
      {opciones.map((opcion, indice) => (
        <button
          key={opcion.valor}
          ref={(elemento) => {
            botones.current[indice] = elemento;
          }}
          type="button"
          role="radio"
          aria-checked={indice === elegido}
          tabIndex={indice === conFoco ? 0 : -1}
          disabled={deshabilitado}
          className={styles.opcion}
          onClick={() => elegir(indice)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );

  if (!etiquetaVisible) return grupo;
  return (
    <div className={styles.campo}>
      <span id={idEtiqueta} className={styles.etiqueta}>
        {etiqueta}
      </span>
      {grupo}
    </div>
  );
}
