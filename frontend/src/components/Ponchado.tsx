import type { Prioridad } from "../api/types";
import { prioridades } from "../theme/theme";

export function Ponchado({ prioridad }: { prioridad: Prioridad }) {
  const p = prioridades[prioridad];
  const etiqueta = `Prioridad ${p.etiqueta}`;
  return (
    <span className={`tq-ponchado${p.resaltar ? " tq-ponchado--critica" : ""}`} title={etiqueta} aria-label={etiqueta} role="img">
      {Array.from({ length: p.perforaciones }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}
