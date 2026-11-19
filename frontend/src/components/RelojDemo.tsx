import { Clock } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { demo, type AjusteRelojDemo } from "../api/endpoints";
import { useJornada } from "../jornada/JornadaContext";
import { Boton } from "./Boton";
import { Desplegable } from "./Desplegable";
import styles from "./RelojDemo.module.css";

export const ACCESOS_DEMO = ["08:00", "12:00", "17:55", "19:30"] as const;

const HORA_VALIDA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function RelojDemo() {
  const { jornada, actualizar } = useJornada();
  const idOtra = useId();
  const [disponible, setDisponible] = useState(false);
  const [otra, setOtra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);

  useEffect(() => {
    let vigente = true;
    demo.reloj().then(
      () => {
        if (vigente) setDisponible(true);
      },
      // RF-6: sin el endpoint (404 o sin red) no se dibuja nada ni se avisa.
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, []);

  if (!disponible) return null;

  async function aplicar(ajuste: AjusteRelojDemo, cerrar: () => void) {
    if (enCurso.current) return;
    enCurso.current = true;
    setError(null);
    try {
      await demo.ajustar(ajuste);
    } catch {
      setError("No se pudo cambiar la hora.");
      enCurso.current = false;
      return;
    }
    await actualizar();
    enCurso.current = false;
    setOtra("");
    cerrar();
  }

  function aplicarOtra(evento: FormEvent<HTMLFormElement>, cerrar: () => void) {
    evento.preventDefault();
    const hora = otra.slice(0, 5);
    if (HORA_VALIDA.test(hora)) void aplicar({ hora }, cerrar);
  }

  return (
    <aside className={styles.reloj} aria-label="Reloj de demostración">
      <Desplegable texto={jornada ? `Demo · ${jornada.reloj}` : "Demo"} icono={Clock} alineacion="inicio">
        {(cerrar) => (
          <div className={styles.contenido}>
            <div className={styles.accesos}>
              {ACCESOS_DEMO.map((hora) => (
                <Boton key={hora} variante="secundario" onClick={() => void aplicar({ hora }, cerrar)}>
                  {hora}
                </Boton>
              ))}
            </div>
            <form className={styles.otra} onSubmit={(evento) => aplicarOtra(evento, cerrar)}>
              <div className={styles.campo}>
                <label className={styles.etiqueta} htmlFor={idOtra}>
                  Otra hora
                </label>
                <input
                  id={idOtra}
                  className={styles.entrada}
                  type="time"
                  required
                  value={otra}
                  onChange={(evento) => setOtra(evento.target.value)}
                />
              </div>
              <Boton type="submit">Aplicar</Boton>
            </form>
            <Boton variante="simple" onClick={() => void aplicar({ real: true }, cerrar)}>
              Hora real
            </Boton>
            {error !== null && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </Desplegable>
    </aside>
  );
}
