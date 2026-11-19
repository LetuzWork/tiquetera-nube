import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Desplegable.module.css";

export interface PropsDesplegable {
  texto: string;
  icono?: LucideIcon;
  alineacion?: "inicio" | "fin";
  children: ReactNode | ((cerrar: () => void) => ReactNode);
}

export function Desplegable({ texto, icono: Icono, alineacion = "fin", children }: PropsDesplegable) {
  const id = useId();
  const idBoton = `${id}-boton`;
  const idPanel = `${id}-panel`;
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const devolverFoco = useRef(false);

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    function alPresionarAfuera(evento: PointerEvent) {
      if (evento.target instanceof Node && raiz.current?.contains(evento.target)) return;
      if (raiz.current?.contains(document.activeElement)) {
        boton.current?.focus();
        devolverFoco.current = true;
      }
      setAbierto(false);
    }
    document.addEventListener("pointerdown", alPresionarAfuera);
    return () => document.removeEventListener("pointerdown", alPresionarAfuera);
  }, [abierto]);

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "Escape" || !abierto) return;
    evento.preventDefault();
    cerrar();
  }

  function alPerderFoco(evento: FocusEvent<HTMLDivElement>) {
    const destino = evento.relatedTarget;
    const tocaDevolver = devolverFoco.current;
    devolverFoco.current = false;
    // Un clic afuera que no cae en un control manda el foco a body; si cae en un control, ese lo conserva.
    if (destino === null && tocaDevolver) boton.current?.focus();
    if (destino instanceof Node && !raiz.current?.contains(destino)) setAbierto(false);
  }

  return (
    <div ref={raiz} className={styles.desplegable} onKeyDown={alTeclear} onBlur={alPerderFoco}>
      <button
        ref={boton}
        id={idBoton}
        type="button"
        className={styles.boton}
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((actual) => !actual)}
      >
        {Icono && <Icono className={styles.icono} strokeWidth={1.75} aria-hidden="true" />}
        <span>{texto}</span>
      </button>
      <div
        id={idPanel}
        role="group"
        aria-labelledby={idBoton}
        className={styles.panel}
        data-alineacion={alineacion}
        hidden={!abierto}
      >
        {typeof children === "function" ? children(cerrar) : children}
      </div>
    </div>
  );
}
