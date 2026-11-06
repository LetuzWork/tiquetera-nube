import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { auth } from "../api/endpoints";
import type { Horario } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { fechaLarga, hhmm } from "../utils/formato";

const PATRON_USUARIO = /^[A-Za-z0-9._-]{1,64}$/;
const NOMBRE_DIA = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function textoDias(dias: number[]): string {
  const seguidos = dias.every((d, i) => i === 0 || d === (dias[i - 1] ?? 0) + 1);
  if (seguidos && dias.length > 2) return `${NOMBRE_DIA[dias[0] ?? 1]} a ${NOMBRE_DIA[dias[dias.length - 1] ?? 5]}`;
  return dias.map((d) => NOMBRE_DIA[d]).join(", ");
}

export function Ventanilla() {
  const { me, iniciarSesion, motivoSalida } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [horario, setHorario] = useState<Horario | null>(null);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    auth.horario().then(setHorario).catch(() => setHorario(null));
  }, []);

  if (me) return <Navigate to="/bandeja" replace />;

  const cerrada = horario !== null && !horario.abierto;
  const franja = horario ? `${hhmm(horario.inicio)} a ${hhmm(horario.fin)}, ${textoDias(horario.dias)}` : "08:00 a 18:00";

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!PATRON_USUARIO.test(usuario.trim())) {
      setError("Usuario inválido: solo letras, números, punto, guion y guion bajo.");
      return;
    }
    if (!password) {
      setError("Ingresá la contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(usuario.trim(), password);
      const desde = (ubicacion.state as { desde?: string } | null)?.desde;
      navegar(desde && desde !== "/ventanilla" ? desde : "/bandeja", { replace: true });
    } catch (err) {
      setPassword("");
      if (err instanceof ApiError && err.codigo === "FUERA_DE_HORARIO") {
        const apertura = typeof err.datos.apertura === "string" ? err.datos.apertura : null;
        setHorario((h) => (h ? { ...h, abierto: false, proxima_apertura: apertura } : h));
      }
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ventanilla-pagina">
      <div className="ventanilla">
        <form className="tq-talon ventanilla-form quieto" onSubmit={enviar} noValidate aria-hidden={cerrada}>
          <span className="etiqueta">Ventanilla de soporte · Active Directory</span>
          <h1>Presentá tu credencial</h1>
          <hr className="tq-perforado" />
          {motivoSalida && <p className="aviso-salida">{motivoSalida}</p>}
          <div className="campo-g">
            <label htmlFor="l-usuario">Usuario de dominio</label>
            <input
              id="l-usuario"
              className="tq-campo"
              autoComplete="username"
              maxLength={64}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              disabled={cerrada}
              autoFocus
            />
          </div>
          <div className="campo-g">
            <label htmlFor="l-clave">Contraseña</label>
            <input
              id="l-clave"
              className="tq-campo"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={cerrada}
            />
          </div>
          <p className="error" role="alert">
            {error}
          </p>
          <button className="tq-boton" type="submit" disabled={enviando || cerrada}>
            {enviando ? "Verificando…" : "Entrar a ventanilla"}
          </button>
          <span className="etiqueta">Atendemos {franja}</span>
        </form>
        {cerrada && (
          <div className="persiana" role="alert">
            <div className="persiana-cartel">
              <b>Ventanilla cerrada</b>
              <span>Atendemos {franja}.</span>
              {horario?.proxima_apertura && <span className="tq-numeradora">Abre el {fechaLarga(horario.proxima_apertura)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
