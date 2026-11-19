import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./Buscador.module.css";

export const ESPERA_BUSQUEDA_MS = 300;

export interface PropsBuscador {
  valor: string;
  alBuscar: (texto: string) => void;
  etiqueta?: string;
  textoAyuda?: string;
  atajo?: boolean;
  maxLength?: number;
}

function esCampoDeTexto(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false;
  return objetivo.isContentEditable || objetivo.closest("input, textarea, select, [contenteditable]") !== null;
}

export function Buscador({
  valor,
  alBuscar,
  etiqueta = "Buscar tickets",
  textoAyuda = "Buscar por número o título",
  atajo = true,
  maxLength = 100,
}: PropsBuscador) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const entrada = useRef<HTMLInputElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitido = useRef(valor);
  const alBuscarActual = useRef(alBuscar);
  alBuscarActual.current = alBuscar;

  function cancelarEspera() {
    if (espera.current !== null) clearTimeout(espera.current);
    espera.current = null;
  }

  function emitir(nuevo: string) {
    emitido.current = nuevo;
    alBuscarActual.current(nuevo);
  }

  function buscarYa(nuevo: string) {
    cancelarEspera();
    emitir(nuevo);
  }

  useEffect(() => {
    // Solo un cambio que vino de afuera (volver, "Limpiar filtros") pisa lo escrito; el eco de lo propio no.
    if (valor.trim() === emitido.current.trim()) return;
    emitido.current = valor;
    cancelarEspera();
    setTexto(valor);
  }, [valor]);

  useEffect(() => cancelarEspera, []);

  useEffect(() => {
    if (!atajo) return;
    function alTeclearDocumento(evento: globalThis.KeyboardEvent) {
      if (evento.key !== "/" || evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (esCampoDeTexto(evento.target)) return;
      evento.preventDefault();
      entrada.current?.focus();
    }
    document.addEventListener("keydown", alTeclearDocumento);
    return () => document.removeEventListener("keydown", alTeclearDocumento);
  }, [atajo]);

  function alEscribir(nuevo: string) {
    setTexto(nuevo);
    cancelarEspera();
    espera.current = setTimeout(() => {
      espera.current = null;
      emitir(nuevo);
    }, ESPERA_BUSQUEDA_MS);
  }

  function borrar() {
    setTexto("");
    buscarYa("");
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      // Sin preventDefault el campo de búsqueda nativo también se vaciaría y dispararía otro cambio.
      evento.preventDefault();
      if (texto !== "") borrar();
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      buscarYa(texto);
    }
  }

  return (
    <div className={styles.buscador}>
      <label className={styles.etiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <Search className={styles.lupa} strokeWidth={1.75} aria-hidden="true" />
      <input
        ref={entrada}
        id={id}
        type="search"
        className={styles.entrada}
        placeholder={textoAyuda}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        aria-keyshortcuts={atajo ? "/" : undefined}
        value={texto}
        onChange={(evento) => alEscribir(evento.target.value)}
        onKeyDown={alTeclear}
      />
      {texto !== "" && (
        <button
          type="button"
          className={styles.borrar}
          aria-label="Borrar búsqueda"
          onClick={() => {
            borrar();
            entrada.current?.focus();
          }}
        >
          <X className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
