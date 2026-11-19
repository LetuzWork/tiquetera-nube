import { SearchX } from "lucide-react";
import { EnlaceBoton } from "../components/Boton";
import { EstadoVacio } from "../components/EstadoVacio";

export function NoEncontrado() {
  return (
    <EstadoVacio
      icono={SearchX}
      titulo="Esta página no existe."
      accion={
        <EnlaceBoton to="/bandeja" variante="primario">
          Volver a Tickets
        </EnlaceBoton>
      }
    />
  );
}
