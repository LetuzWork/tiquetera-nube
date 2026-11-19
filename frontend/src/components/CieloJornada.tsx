import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ColoresCielo } from "../jornada/cielo";
import { marcasDelDia, textoCuenta } from "../jornada/horizonte";
import { textoCompacto, textoEstado, textoFranja } from "../jornada/jornada";
import { useJornada } from "../jornada/JornadaContext";
import { useTicketsDeHoy } from "../jornada/useTicketsDeHoy";
import styles from "./CieloJornada.module.css";
import { Cuenta } from "./Cuenta";
import { Horizonte } from "./Horizonte";
import { Logo } from "./Logo";
import { Navegacion } from "./Navegacion";

function estiloDe(cielo: ColoresCielo | null): CSSProperties | undefined {
  if (!cielo) return undefined;
  return { "--tq-cielo-arriba": cielo.arriba, "--tq-cielo-abajo": cielo.abajo, "--tq-cielo-tinta": cielo.tinta };
}

export function CieloJornada() {
  const { me, fin } = useAuth();
  const { horario, jornada, cielo, sinFranja } = useJornada();
  const { pagina, fallo } = useTicketsDeHoy(jornada?.hoy ?? null, fin !== null);
  const cabecera = useRef<HTMLElement>(null);
  const [compacta, setCompacta] = useState(false);

  useEffect(() => {
    const elemento = cabecera.current;
    if (!elemento) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const ultima = entradas[entradas.length - 1];
        if (ultima) setCompacta(!ultima.isIntersecting);
      },
      { threshold: 0 },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const deUsuario = me?.rol === "usuario";
  const cuenta = fallo ? textoCuenta(null, deUsuario) : pagina ? textoCuenta(pagina.total, deUsuario) : null;
  const estilo = estiloDe(cielo);

  return (
    <>
      <header ref={cabecera} className={styles.cielo} data-tinta={cielo?.tinta} style={estilo}>
        <div className={styles.contenido}>
          <div className={styles.fila}>
            <div className={styles.logo}>
              <Logo />
            </div>
            <div className={styles.navegacion}>
              <Navegacion />
            </div>
            <div className={styles.cuenta}>
              <Cuenta />
            </div>
          </div>
          {horario && jornada ? (
            <>
              <div className={styles.jornada}>
                <p className={styles.reloj}>{jornada.reloj}</p>
                <div className={styles.estado}>
                  <p className={styles.textoEstado} data-jornada={jornada.estado}>
                    {textoEstado(jornada)}
                  </p>
                  <p className={styles.franja}>{textoFranja(horario)}</p>
                </div>
              </div>
              <div className={styles.dia}>
                <Horizonte
                  horario={horario}
                  jornada={jornada}
                  marcas={pagina ? marcasDelDia(pagina.items, horario) : []}
                  cuenta={cuenta}
                />
                {cuenta !== null && <p className={styles.cuentaTickets}>{cuenta}</p>}
              </div>
            </>
          ) : (
            sinFranja && <p className={styles.sinFranja}>No se pudo consultar el horario.</p>
          )}
        </div>
      </header>
      {compacta && (
        <div className={styles.barra} data-barra="compacta" data-tinta={cielo?.tinta} style={estilo}>
          <div className={styles.barraContenido}>
            <div className={styles.logo}>
              <Logo />
            </div>
            <div className={styles.navegacion}>
              <Navegacion etiqueta="Secciones, barra fija" />
            </div>
            {horario && jornada && <p className={styles.estadoCorto}>{textoCompacto(jornada, horario)}</p>}
            <div className={styles.cuenta}>
              <Cuenta />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
