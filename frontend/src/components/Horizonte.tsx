import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Horario } from "../api/types";
import {
  accionAlTocar,
  etiquetaMarca,
  indiceSiguiente,
  nombreHorizonte,
  porcentaje,
  posicionEnFranja,
  type Marca,
} from "../jornada/horizonte";
import type { Jornada } from "../jornada/jornada";
import { hhmm } from "../utils/zona";
import styles from "./Horizonte.module.css";

export interface PropsHorizonte {
  horario: Horario;
  jornada: Jornada;
  marcas: Marca[];
  cuenta: string | null;
}

type Alineacion = "inicio" | "centro" | "fin";

const TECLAS_DE_RECORRIDO = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

function alineacionDe(posicion: number): Alineacion {
  if (posicion < 1 / 3) return "inicio";
  if (posicion > 2 / 3) return "fin";
  return "centro";
}

export function Horizonte({ horario, jornada, marcas, cuenta }: PropsHorizonte) {
  const navegar = useNavigate();
  const raiz = useRef<HTMLDivElement>(null);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const clicDescartado = useRef<number | null>(null);
  const [activo, setActivo] = useState(0);
  const [bajoPuntero, setBajoPuntero] = useState<number | null>(null);
  const [tocada, setTocada] = useState<number | null>(null);
  const [conFoco, setConFoco] = useState<number | null>(null);

  const indiceActivo = Math.min(activo, Math.max(0, marcas.length - 1));
  const conEtiqueta = bajoPuntero ?? tocada ?? conFoco;
  const marcaConEtiqueta = marcas.find((marca) => marca.numero === conEtiqueta);
  const avance = porcentaje(posicionEnFranja(jornada.segundosDelDia, horario));

  useEffect(() => {
    if (tocada === null) return;
    // Safari no enfoca el botón al tocarlo, así que el blur no alcanza para ocultar la etiqueta.
    function alTocarAfuera(evento: globalThis.PointerEvent) {
      if (evento.target instanceof Node && raiz.current?.contains(evento.target)) return;
      setTocada(null);
    }
    document.addEventListener("pointerdown", alTocarAfuera);
    return () => document.removeEventListener("pointerdown", alTocarAfuera);
  }, [tocada]);

  function alPresionar(evento: PointerEvent<HTMLButtonElement>, numero: number) {
    clicDescartado.current = null;
    if (evento.pointerType !== "touch") return;
    if (accionAlTocar(conEtiqueta, numero) === "mostrar") {
      setTocada(numero);
      clicDescartado.current = numero;
    }
  }

  function alHacerClic(numero: number) {
    if (clicDescartado.current === numero) {
      clicDescartado.current = null;
      return;
    }
    navegar(`/tickets/${numero}`);
  }

  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    clicDescartado.current = null;
    if (!TECLAS_DE_RECORRIDO.has(evento.key)) return;
    evento.preventDefault();
    const siguiente = indiceSiguiente(indice, evento.key, marcas.length);
    if (siguiente === indice) return;
    setActivo(siguiente);
    botones.current[siguiente]?.focus();
  }

  return (
    <div
      ref={raiz}
      role="group"
      aria-label={nombreHorizonte(horario, jornada, cuenta)}
      tabIndex={marcas.length === 0 ? 0 : undefined}
      className={styles.horizonte}
      style={{ "--tq-avance": avance }}
    >
      <div className={styles.pista}>
        <span className={styles.resto} aria-hidden="true" />
        <span className={styles.transcurrido} aria-hidden="true" />
        <span className={styles.sol} data-atenuado={jornada.estado === "cerrada"} aria-hidden="true" />
        {marcas.map((marca, indice) => (
          <button
            key={marca.numero}
            ref={(elemento) => {
              botones.current[indice] = elemento;
            }}
            type="button"
            className={styles.marca}
            data-estado={marca.estado}
            aria-label={etiquetaMarca(marca)}
            tabIndex={indice === indiceActivo ? 0 : -1}
            style={{ "--tq-posicion": porcentaje(marca.posicion) }}
            onClick={() => alHacerClic(marca.numero)}
            onKeyDown={(evento) => alTeclear(evento, indice)}
            onPointerDown={(evento) => alPresionar(evento, marca.numero)}
            onPointerEnter={(evento) => {
              if (evento.pointerType !== "touch") setBajoPuntero(marca.numero);
            }}
            onPointerLeave={(evento) => {
              if (evento.pointerType !== "touch") setBajoPuntero((actual) => (actual === marca.numero ? null : actual));
            }}
            onFocus={() => {
              setActivo(indice);
              setConFoco(marca.numero);
            }}
            onBlur={() => {
              setConFoco((actual) => (actual === marca.numero ? null : actual));
              setTocada((actual) => (actual === marca.numero ? null : actual));
            }}
          >
            <span className={styles.punto} aria-hidden="true" />
          </button>
        ))}
        {marcaConEtiqueta && (
          <span
            className={styles.etiqueta}
            data-alineacion={alineacionDe(marcaConEtiqueta.posicion)}
            style={{ "--tq-posicion": porcentaje(marcaConEtiqueta.posicion) }}
            aria-hidden="true"
          >
            {etiquetaMarca(marcaConEtiqueta)}
          </span>
        )}
      </div>
      <div className={styles.horas}>
        <span aria-hidden="true">{hhmm(horario.inicio)}</span>
        <span aria-hidden="true">{hhmm(horario.fin)}</span>
      </div>
    </div>
  );
}
