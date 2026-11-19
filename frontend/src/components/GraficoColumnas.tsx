import { useId } from "react";
import { TablaDelGrafico, type PuntoGrafico } from "./GraficoBarras";
import styles from "./GraficoColumnas.module.css";

export interface PropsGraficoColumnas {
  titulo: string;
  datos: readonly PuntoGrafico[];
  columna: string;
  columnaValor?: string;
  textoVacio?: string;
  maxEtiquetas?: number;
}

// Con más columnas que esto, el valor escrito no entra arriba de cada una a 360px; queda en la tabla.
const MAX_CON_VALOR = 10;

export function GraficoColumnas({
  titulo,
  datos,
  columna,
  columnaValor = "Tickets",
  textoVacio = "Sin tickets en el período.",
  maxEtiquetas = 5,
}: PropsGraficoColumnas) {
  const idTitulo = `${useId()}-titulo`;
  const total = datos.length;
  const paso = Math.max(1, Math.ceil(total / Math.max(1, maxEtiquetas)));
  const conValor = total <= MAX_CON_VALOR;
  return (
    <section className={styles.grafico} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={styles.titulo}>
        {titulo}
      </h2>
      {total === 0 ? (
        <p className={styles.vacio}>{textoVacio}</p>
      ) : (
        <>
          <div className={styles.columnas} aria-hidden="true" style={{ "--tq-columnas": total }}>
            {datos.map((punto, indice) => (
              <div key={punto.clave} className={styles.columna}>
                <span className={styles.valor} data-oculto={conValor ? undefined : "true"}>
                  {punto.valor}
                </span>
                <span className={styles.area}>
                  <span
                    className={styles.barra}
                    data-vacia={punto.valor === 0 ? "true" : undefined}
                    style={{ "--tq-fraccion": punto.fraccion, "--tq-color-barra": punto.color }}
                  />
                </span>
                <span className={styles.etiqueta} data-oculta={(total - 1 - indice) % paso === 0 ? undefined : "true"}>
                  {punto.etiqueta}
                </span>
              </div>
            ))}
          </div>
          <TablaDelGrafico datos={datos} columna={columna} columnaValor={columnaValor} />
        </>
      )}
    </section>
  );
}
