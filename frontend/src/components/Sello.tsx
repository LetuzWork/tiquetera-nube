import type { CSSProperties } from "react";
import type { Estado } from "../api/types";
import { estados } from "../theme/theme";

export function Sello({ estado }: { estado: Estado }) {
  const p = estados[estado];
  const estilo = { "--tq-sello-color": p.color, textDecoration: p.tachado ? "line-through" : undefined } as CSSProperties;
  return (
    <span className="tq-sello" style={estilo}>
      {p.etiqueta}
    </span>
  );
}

export function SelloLibre({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="tq-sello" style={{ "--tq-sello-color": color } as CSSProperties}>
      {texto}
    </span>
  );
}
