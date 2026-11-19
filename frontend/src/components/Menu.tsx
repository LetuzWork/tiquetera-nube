import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Menu.module.css";

export interface ItemMenu {
  texto: string;
  alElegir: () => void;
}

export type VarianteMenu = "cielo" | "comun";

export interface PropsMenu {
  etiqueta: string;
  contenido: ReactNode;
  descripcion?: ReactNode;
  items: ItemMenu[];
  variante?: VarianteMenu;
}

type Extremo = "primero" | "ultimo";

export function Menu({ etiqueta, contenido, descripcion, items, variante = "cielo" }: PropsMenu) {
  const id = useId();
  const idBoton = `${id}-boton`;
  const idMenu = `${id}-menu`;
  const idDescripcion = `${id}-descripcion`;
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const opciones = useRef<(HTMLButtonElement | null)[]>([]);
  const focoPendiente = useRef<Extremo | null>(null);

  function enfocar(indice: number) {
    const total = items.length;
    if (total === 0) return;
    opciones.current[((indice % total) + total) % total]?.focus();
  }

  function enfocarExtremo(extremo: Extremo) {
    enfocar(extremo === "primero" ? 0 : items.length - 1);
  }

  function abrir(extremo: Extremo) {
    if (abierto) {
      enfocarExtremo(extremo);
      return;
    }
    focoPendiente.current = extremo;
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  function elegir(item: ItemMenu) {
    cerrar();
    item.alElegir();
  }

  useEffect(() => {
    if (!abierto || focoPendiente.current === null) return;
    enfocarExtremo(focoPendiente.current);
    focoPendiente.current = null;
  });

  useEffect(() => {
    if (!abierto) return;
    function alPresionarAfuera(evento: PointerEvent) {
      if (evento.target instanceof Node && raiz.current?.contains(evento.target)) return;
      setAbierto(false);
    }
    document.addEventListener("pointerdown", alPresionarAfuera);
    return () => document.removeEventListener("pointerdown", alPresionarAfuera);
  }, [abierto]);

  function alTeclearBoton(evento: KeyboardEvent<HTMLButtonElement>) {
    // Se abre en keydown y se anula la activación nativa, así el Enter no termina eligiendo el primer ítem.
    if (evento.key === "Enter" || evento.key === " " || evento.key === "ArrowDown") {
      evento.preventDefault();
      abrir("primero");
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      abrir("ultimo");
    } else if (evento.key === "Escape" && abierto) {
      evento.preventDefault();
      cerrar();
    }
  }

  function alTeclearMenu(evento: KeyboardEvent<HTMLDivElement>) {
    const actual = opciones.current.findIndex((opcion) => opcion === evento.target);
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        enfocar(actual + 1);
        break;
      case "ArrowUp":
        evento.preventDefault();
        enfocar(actual - 1);
        break;
      case "Home":
        evento.preventDefault();
        enfocarExtremo("primero");
        break;
      case "End":
        evento.preventDefault();
        enfocarExtremo("ultimo");
        break;
      case "Escape":
        evento.preventDefault();
        cerrar();
        break;
      case "Enter":
      case " ": {
        evento.preventDefault();
        const item = items[actual];
        if (item) elegir(item);
        break;
      }
      case "Tab":
        // Sin preventDefault: el foco sigue su camino natural y el menú se cierra.
        setAbierto(false);
        break;
    }
  }

  return (
    <div className={styles.menu} ref={raiz}>
      <button
        ref={boton}
        id={idBoton}
        type="button"
        className={styles.boton}
        data-variante={variante}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={idMenu}
        onClick={() => (abierto ? setAbierto(false) : abrir("primero"))}
        onKeyDown={alTeclearBoton}
      >
        {contenido}
      </button>
      <div className={styles.panel} hidden={!abierto} onMouseDown={(evento) => evento.preventDefault()}>
        {descripcion !== undefined && (
          <p id={idDescripcion} className={styles.descripcion}>
            {descripcion}
          </p>
        )}
        <div
          role="menu"
          id={idMenu}
          aria-labelledby={idBoton}
          aria-describedby={descripcion !== undefined ? idDescripcion : undefined}
          className={styles.lista}
          onKeyDown={alTeclearMenu}
        >
          {items.map((item, indice) => (
            <button
              key={item.texto}
              ref={(elemento) => {
                opciones.current[indice] = elemento;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              onClick={() => elegir(item)}
            >
              {item.texto}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
