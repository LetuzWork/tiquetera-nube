import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { minutosAvisoCierre } from "../theme/theme";
import { duracion } from "../utils/formato";

export function RelojTurno() {
  const { me, cerrarSesion } = useAuth();
  const limite = useRef(0);
  const [restantes, setRestantes] = useState(me?.segundos_restantes ?? 0);

  useEffect(() => {
    if (!me) return;
    limite.current = Date.now() + me.segundos_restantes * 1000;
    const tick = () => {
      const s = Math.max(0, (limite.current - Date.now()) / 1000);
      setRestantes(s);
      if (s <= 0) void cerrarSesion("Tu sesión venció. Si la ventanilla sigue abierta, volvé a ingresar.");
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [me, cerrarSesion]);

  if (!me) return null;
  const aviso = restantes <= minutosAvisoCierre * 60;
  return (
    <span className={`reloj${aviso ? " reloj--aviso" : ""}`} title={`La sesión vence ${new Date(me.sesion_expira).toLocaleTimeString("es-AR")}`}>
      sesión <b className="tq-numeradora">{duracion(restantes)}</b>
    </span>
  );
}
