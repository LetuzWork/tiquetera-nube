import { useEffect, useState } from "react";
import { usuarios } from "../api/endpoints";
import type { Persona } from "../api/types";
import { useAuth } from "../auth/AuthContext";

const SIN_RESPONSABLES: Persona[] = [];

export function useResponsables(): Persona[] {
  const { puede } = useAuth();
  const habilitado = puede("ticket:asignar");
  const [lista, setLista] = useState<Persona[]>(SIN_RESPONSABLES);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    usuarios
      .responsables()
      .then((recibida) => {
        if (vigente) setLista(recibida);
      })
      .catch(() => {
        if (vigente) setLista(SIN_RESPONSABLES);
      });
    return () => {
      vigente = false;
    };
  }, [habilitado]);

  return habilitado ? lista : SIN_RESPONSABLES;
}
