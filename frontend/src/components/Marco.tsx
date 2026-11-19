import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { textosFin } from "../auth/sesion";
import { useVencimientoSesion } from "../auth/useVencimientoSesion";
import { useJornada } from "../jornada/JornadaContext";
import { Aviso } from "./Aviso";
import { ProveedorAvisos } from "./Avisos";
import { CieloJornada } from "./CieloJornada";
import { Confirmacion } from "./Confirmacion";
import styles from "./Marco.module.css";
import { Vidrio } from "./Vidrio";

type TextosFin = ReturnType<typeof textosFin>;

export function Marco() {
  const { fin, cerrarSesion } = useAuth();
  const { horario, actualizar } = useJornada();
  const { aviso, cerrarAviso } = useVencimientoSesion();
  const [dialogo, setDialogo] = useState<TextosFin | null>(null);
  const resto = useRef<HTMLDivElement>(null);
  const aceptado = useRef(false);

  useEffect(() => {
    if (fin === null) {
      aceptado.current = false;
      setDialogo(null);
      return;
    }
    if (fin === "duracion" || horario !== null) {
      setDialogo((abierto) => abierto ?? textosFin(fin, horario));
      return;
    }
    // D-07: sin franja no hay texto para "La jornada terminó"; se consulta una vez y el diálogo se abre responda o no.
    let vigente = true;
    void actualizar()
      .catch(() => null)
      .then((recibido) => {
        if (vigente) setDialogo((abierto) => abierto ?? textosFin(fin, recibido));
      });
    return () => {
      vigente = false;
    };
  }, [fin, horario, actualizar]);

  useLayoutEffect(() => {
    // React 18 no conoce inert: como prop booleana avisa en consola, así que va directo al DOM.
    resto.current?.toggleAttribute("inert", dialogo !== null);
  }, [dialogo]);

  function aceptar() {
    if (dialogo === null || aceptado.current) return;
    aceptado.current = true;
    void cerrarSesion(dialogo.motivoSalida);
  }

  return (
    <>
      <div ref={resto} className={styles.marco} aria-hidden={dialogo !== null ? "true" : undefined}>
        <ProveedorAvisos
          avisoFijo={
            <Aviso abierto={aviso !== null} alCerrar={cerrarAviso}>
              {aviso}
            </Aviso>
          }
        >
          <CieloJornada />
          <Vidrio desenfocado={fin !== null}>
            <Outlet />
          </Vidrio>
        </ProveedorAvisos>
      </div>
      {dialogo !== null && <Confirmacion titulo={dialogo.titulo} texto={dialogo.descripcion} alAceptar={aceptar} />}
    </>
  );
}
