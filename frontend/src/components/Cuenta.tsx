import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { textoSesionHasta } from "../auth/sesion";
import { useJornada } from "../jornada/JornadaContext";
import { ETIQUETA_ROL } from "../utils/presentacion";
import { Avatar } from "./Avatar";
import styles from "./Cuenta.module.css";
import { Menu } from "./Menu";

export function Cuenta() {
  const { me, cerrarSesion } = useAuth();
  const { zona } = useJornada();
  if (!me) return null;
  return (
    <div className={styles.cuenta}>
      <Menu
        etiqueta={`Cuenta de ${me.nombre}`}
        contenido={
          <>
            <Avatar nombre={me.nombre} />
            <span className={styles.datos}>
              <span className={styles.nombre}>{me.nombre}</span>
              <span className={styles.rol}>{ETIQUETA_ROL[me.rol]}</span>
            </span>
            <ChevronDown className={styles.icono} strokeWidth={1.75} aria-hidden="true" />
          </>
        }
        descripcion={textoSesionHasta(me.sesion_expira, zona)}
        items={[{ texto: "Cerrar sesión", alElegir: () => void cerrarSesion() }]}
      />
    </div>
  );
}
