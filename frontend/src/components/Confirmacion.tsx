import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Boton, type VarianteBoton } from "./Boton";
import styles from "./Confirmacion.module.css";

export interface PropsConfirmacion {
  titulo: string;
  texto: string;
  alAceptar: () => void;
  alCancelar?: () => void;
  textoAceptar?: string;
  varianteAceptar?: VarianteBoton;
}

export function Confirmacion({
  titulo,
  texto,
  alAceptar,
  alCancelar,
  textoAceptar = "Aceptar",
  varianteAceptar = "primario",
}: PropsConfirmacion) {
  const id = useId();
  const idTitulo = `${id}-titulo`;
  const idTexto = `${id}-texto`;
  const aceptar = useRef<HTMLButtonElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const cancelable = alCancelar !== undefined;

  useEffect(() => {
    if (!cancelable) {
      aceptar.current?.focus();
      return;
    }
    const previo = document.activeElement;
    cancelar.current?.focus();
    return () => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, [cancelable]);

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape" && alCancelar) {
      evento.preventDefault();
      alCancelar();
      return;
    }
    if (evento.key !== "Tab") return;
    evento.preventDefault();
    // Sin cancelar, "Aceptar" es lo único enfocable; con cancelar, Tab y Shift+Tab alternan entre los dos.
    if (!cancelable) aceptar.current?.focus();
    else if (evento.target === cancelar.current) aceptar.current?.focus();
    else cancelar.current?.focus();
  }

  function alPresionar(evento: MouseEvent<HTMLDivElement>) {
    if (evento.target === aceptar.current || (cancelable && evento.target === cancelar.current)) return;
    evento.preventDefault();
  }

  return createPortal(
    <div className={styles.velo} onMouseDown={alPresionar}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        className={styles.panel}
        onKeyDown={alTeclear}
      >
        <h2 id={idTitulo} className={styles.titulo}>
          {titulo}
        </h2>
        <p id={idTexto} className={styles.texto}>
          {texto}
        </p>
        {cancelable ? (
          <div className={styles.acciones}>
            <Boton ref={cancelar} variante="secundario" onClick={alCancelar}>
              Cancelar
            </Boton>
            <Boton ref={aceptar} variante={varianteAceptar} onClick={alAceptar}>
              {textoAceptar}
            </Boton>
          </div>
        ) : (
          <Boton ref={aceptar} variante={varianteAceptar} anchoCompleto onClick={alAceptar}>
            {textoAceptar}
          </Boton>
        )}
      </div>
    </div>,
    document.body,
  );
}
