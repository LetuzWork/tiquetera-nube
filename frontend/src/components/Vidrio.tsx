import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./Vidrio.module.css";

export type VarianteVidrio = "marco" | "angosta";

export interface PropsVidrio {
  children: ReactNode;
  desenfocado?: boolean;
  variante?: VarianteVidrio;
}

export function Vidrio({ children, desenfocado = false, variante = "marco" }: PropsVidrio) {
  const contenido = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // React 18 no conoce inert: como prop booleana avisa en consola, así que va directo al DOM.
    contenido.current?.toggleAttribute("inert", desenfocado);
  }, [desenfocado]);

  return (
    <main className={styles.vidrio} data-variante={variante}>
      <div
        ref={contenido}
        className={styles.contenido}
        data-desenfocado={desenfocado}
        aria-hidden={desenfocado ? "true" : undefined}
      >
        {children}
      </div>
    </main>
  );
}
