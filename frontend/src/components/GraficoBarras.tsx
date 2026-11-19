import { useId } from "react";
import styles from "./GraficoBarras.module.css";

export interface PuntoGrafico {
  clave: string;
  etiqueta: string;
  valor: number;
  fraccion: number;
  color?: string;
}

export interface PropsGraficoBarras {
  titulo: string;
  datos: readonly PuntoGrafico[];
  columna: string;
  columnaValor?: string;
  textoVacio?: string;
}

export function GraficoBarras({
  titulo,
  datos,
  columna,
  columnaValor = "Tickets",
  textoVacio = "Sin tickets en el período.",
}: PropsGraficoBarras) {
  const idTitulo = `${useId()}-titulo`;
  return (
    <section className={styles.grafico} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={styles.titulo}>
        {titulo}
      </h2>
      {datos.length === 0 ? (
        <p className={styles.vacio}>{textoVacio}</p>
      ) : (
        <>
          <div className={styles.barras} aria-hidden="true">
            {datos.map((punto) => (
              <div key={punto.clave} className={styles.fila}>
                <span className={styles.etiqueta}>{punto.etiqueta}</span>
                <span className={styles.pista}>
                  <span
                    className={styles.barra}
                    data-vacia={punto.valor === 0 ? "true" : undefined}
                    style={{ "--tq-fraccion": punto.fraccion, "--tq-color-barra": punto.color }}
                  />
                </span>
                <span className={styles.valor}>{punto.valor}</span>
              </div>
            ))}
          </div>
          <TablaDelGrafico datos={datos} columna={columna} columnaValor={columnaValor} />
        </>
      )}
    </section>
  );
}

export interface PropsTablaDelGrafico {
  datos: readonly PuntoGrafico[];
  columna: string;
  columnaValor: string;
}

export function TablaDelGrafico({ datos, columna, columnaValor }: PropsTablaDelGrafico) {
  // Una <table> no se achica a 1px con tq-solo-lectores: la recorta un bloque, así no estira la página.
  return (
    <div className="tq-solo-lectores">
      <table>
        <thead>
          <tr>
            <th scope="col">{columna}</th>
            <th scope="col">{columnaValor}</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((punto) => (
            <tr key={punto.clave}>
              <th scope="row">{punto.etiqueta}</th>
              <td>{punto.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
