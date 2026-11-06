import type { Evento } from "../api/types";
import { describirEvento, fechaCorta } from "../utils/formato";

export function Libreta({ eventos }: { eventos: Evento[] }) {
  return (
    <ol className="libreta" aria-label="Historial del ticket">
      {eventos.map((e, i) => (
        <li key={i} title={`${fechaCorta(e.fecha)} ${e.autor} ${describirEvento(e)}`}>
          <span className="libreta-fecha">{fechaCorta(e.fecha)}</span> <b>{e.autor}</b> {describirEvento(e)}
        </li>
      ))}
    </ol>
  );
}
