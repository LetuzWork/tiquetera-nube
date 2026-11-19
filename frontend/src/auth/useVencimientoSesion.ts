import { useCallback, useEffect, useRef, useState } from "react";
import { useJornada } from "../jornada/JornadaContext";
import { useAuth } from "./AuthContext";
import { faseSesion, MS_AVISO_SESION, motivoDeVencimiento, msHastaVencimiento, textoAvisoSesion } from "./sesion";

export function useVencimientoSesion(): { aviso: string | null; cerrarAviso: () => void } {
  const { me, recibidoEn, fin, terminarSesion, relojMonotono } = useAuth();
  const { ahora, horario, zona, actualizar } = useJornada();
  const [aviso, setAviso] = useState<string | null>(null);
  const [despertar, setDespertar] = useState(0);
  const avisadoPara = useRef<string | null>(null);
  const terminandoPara = useRef<string | null>(null);
  const marcaDeAhora = useRef(0);
  const expiraActual = useRef<string | null>(null);

  useEffect(() => {
    marcaDeAhora.current = relojMonotono();
  }, [ahora, relojMonotono]);

  useEffect(() => {
    expiraActual.current = me?.sesion_expira ?? null;
  }, [me]);

  useEffect(() => {
    if (!me || recibidoEn === null) {
      avisadoPara.current = null;
      terminandoPara.current = null;
      setAviso(null);
      return;
    }
    const marca = relojMonotono();
    // `ahora` cambia con el tic: se le suma lo que pasó desde entonces para que el umbral salga en su minuto.
    const ahoraServidor = ahora === null ? null : ahora + (marca - marcaDeAhora.current);
    const ms = msHastaVencimiento(me, ahoraServidor, recibidoEn, marca);
    const fase = faseSesion(ms);
    const expira = me.sesion_expira;
    if (fase === "por-vencer" && avisadoPara.current !== expira) {
      avisadoPara.current = expira;
      setAviso(textoAvisoSesion(expira, zona));
    }
    if (fase === "vencida") {
      if (fin === null && terminandoPara.current !== expira) {
        terminandoPara.current = expira;
        void (async () => {
          const franja = horario ?? (await actualizar());
          if (expiraActual.current === expira) terminarSesion(motivoDeVencimiento(expira, franja));
        })();
      }
      return;
    }
    const espera = fase === "vigente" ? ms - MS_AVISO_SESION : ms;
    const temporizador = setTimeout(() => setDespertar((n) => n + 1), espera);
    return () => clearTimeout(temporizador);
  }, [me, recibidoEn, ahora, fin, horario, zona, despertar, relojMonotono, actualizar, terminarSesion]);

  const cerrarAviso = useCallback(() => setAviso(null), []);

  return { aviso, cerrarAviso };
}
