import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { destinoTrasIngreso, MS_ESPERA_INGRESO, resultadoIngreso, validarIngreso } from "../auth/ingreso";
import { Boton } from "../components/Boton";
import { Campo } from "../components/Campo";
import { GrupoCampos } from "../components/GrupoCampos";
import { Logo } from "../components/Logo";
import { Vidrio } from "../components/Vidrio";
import type { ColoresCielo } from "../jornada/cielo";
import { textoFranjaEnFrase, textoProximaApertura } from "../jornada/jornada";
import { useJornada } from "../jornada/JornadaContext";
import styles from "./IniciarSesion.module.css";

type ErroresIngreso = ReturnType<typeof validarIngreso>;

function estiloDe(cielo: ColoresCielo | null): CSSProperties | undefined {
  if (!cielo) return undefined;
  return { "--tq-cielo-arriba": cielo.arriba, "--tq-cielo-abajo": cielo.abajo, "--tq-cielo-tinta": cielo.tinta };
}

export function IniciarSesion() {
  const { me, cargando, motivoSalida, iniciarSesion } = useAuth();
  const { horario, jornada, ahora, cielo, sinFranja, actualizar } = useJornada();
  const ubicacion = useLocation();
  const idTitulo = useId();
  const refUsuario = useRef<HTMLInputElement>(null);
  const refContrasena = useRef<HTMLInputElement>(null);
  // El estado de React llega tarde para un segundo envío en el mismo instante.
  const enCurso = useRef(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<ErroresIngreso>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sacudidas, setSacudidas] = useState(0);

  useEffect(() => {
    refUsuario.current?.focus();
  }, []);

  if (me) return <Navigate to={destinoTrasIngreso(ubicacion.state)} replace />;

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (enCurso.current) return;
    const encontrados = validarIngreso(usuario, password);
    setErrores(encontrados);
    if (encontrados.usuario !== undefined || encontrados.password !== undefined) {
      (encontrados.usuario !== undefined ? refUsuario : refContrasena).current?.focus();
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    setError(null);
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), MS_ESPERA_INGRESO);
    try {
      await iniciarSesion(usuario.trim(), password, control.signal);
      void actualizar();
    } catch (falla) {
      const resultado = resultadoIngreso(falla);
      setError(resultado.texto);
      if (resultado.vaciarContrasena) setPassword("");
      if (resultado.sacudir) setSacudidas((n) => n + 1);
      if (resultado.enfocarContrasena) refContrasena.current?.focus();
      if (resultado.reconsultarFranja) void actualizar();
    } finally {
      clearTimeout(plazo);
      enCurso.current = false;
      setEnviando(false);
    }
  };

  const lineaEstado = cargando ? "Verificando tu sesión…" : motivoSalida;
  const franja = horario ? `Podés ingresar ${textoFranjaEnFrase(horario)}.` : null;
  const cerrada = jornada?.estado === "cerrada";
  const proximaApertura = horario && ahora !== null ? textoProximaApertura(horario, ahora) : null;

  return (
    <div className={styles.pantalla} data-pantalla="ingreso" data-tinta={cielo?.tinta} style={estiloDe(cielo)}>
      <header className={styles.cabecera}>
        <div className={styles.logo}>
          <Logo />
        </div>
        {horario && jornada && (
          <div className={styles.hora}>
            <p className={styles.reloj}>{jornada.reloj}</p>
            {!cerrada && <p className={styles.franja}>{franja}</p>}
          </div>
        )}
      </header>
      <Vidrio variante="angosta">
        <div className={styles.panel}>
          {lineaEstado && (
            <p className={styles.estado} role="status">
              {lineaEstado}
            </p>
          )}
          {horario && cerrada && (
            <div className={styles.aviso} data-aviso="fuera-de-horario">
              <p className={styles.avisoTitulo}>Fuera del horario de atención</p>
              <p>{franja}</p>
              {proximaApertura && <p>{proximaApertura}</p>}
            </div>
          )}
          {sinFranja && (
            <div className={styles.aviso} data-aviso="sin-franja">
              <p>No se pudo consultar el horario.</p>
            </div>
          )}
          <div className={styles.titulos}>
            <h1 id={idTitulo} className={styles.titulo}>
              Iniciar sesión
            </h1>
            <p className={styles.subtitulo}>Usá tu cuenta de dominio</p>
          </div>
          <form className={styles.formulario} aria-labelledby={idTitulo} noValidate onSubmit={(evento) => void enviar(evento)}>
            <GrupoCampos leyenda="Cuenta de dominio" leyendaOculta sacudidas={sacudidas}>
              <Campo
                ref={refUsuario}
                etiqueta="Usuario"
                autoComplete="username"
                value={usuario}
                onChange={(evento) => setUsuario(evento.target.value)}
                error={errores.usuario}
              />
              <Campo
                ref={refContrasena}
                etiqueta="Contraseña"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                value={password}
                onChange={(evento) => setPassword(evento.target.value)}
                error={errores.password}
              />
            </GrupoCampos>
            <div className={styles.envio}>
              <p className={styles.error} role="alert">
                {error}
              </p>
              <Boton type="submit" anchoCompleto cargando={enviando} textoCargando="Iniciando sesión…">
                Iniciar sesión
              </Boton>
            </div>
          </form>
        </div>
      </Vidrio>
    </div>
  );
}
