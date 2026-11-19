import { CloudOff, Download, Inbox, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { reportes } from "../api/endpoints";
import { CATEGORIAS, ESTADOS, PRIORIDADES, type Resumen } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Boton } from "../components/Boton";
import { GraficoBarras } from "../components/GraficoBarras";
import { GraficoColumnas } from "../components/GraficoColumnas";
import { Menu } from "../components/Menu";
import { Segmentado } from "../components/Segmentado";
import { useJornada } from "../jornada/JornadaContext";
import {
  completarDias,
  PERIODO_INICIAL,
  PERIODOS,
  rangoDePeriodo,
  serie,
  textoHoras,
  type Periodo,
  type Rango,
} from "../reportes/reportes";
import { ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD } from "../utils/presentacion";
import { fechaCortaDeDia } from "../utils/zona";
import styles from "./Reportes.module.css";

type ArchivoExport = "tickets" | "historial";

interface Cargado {
  resumen: Resumen;
  rango: Rango;
}

// El backend agrupa los tickets sin responsable bajo esta clave.
const ETIQUETA_RESPONSABLE: Record<string, string> = { "sin asignar": "Sin asignar" };

function etiquetasDeDias(dias: string[]): Record<string, string> {
  return Object.fromEntries(dias.map((dia) => [dia, fechaCortaDeDia(dia)]));
}

export function Reportes() {
  const { puede } = useAuth();
  const { jornada, sinFranja, actualizar } = useJornada();
  const hoy = jornada?.hoy ?? null;
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const [fallo, setFallo] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [intento, setIntento] = useState(0);

  const rango = useMemo(() => (hoy === null ? null : rangoDePeriodo(periodo, hoy)), [periodo, hoy]);

  useEffect(() => {
    if (rango === null) return;
    let vigente = true;
    setPidiendo(true);
    setFallo(false);
    reportes.resumen(rango).then(
      (resumen) => {
        if (!vigente) return;
        setCargado({ resumen, rango });
        setPidiendo(false);
      },
      () => {
        if (!vigente) return;
        setFallo(true);
        setPidiendo(false);
      },
    );
    return () => {
      vigente = false;
    };
  }, [rango, intento]);

  function reintentar() {
    if (rango === null) void actualizar();
    else setIntento((n) => n + 1);
  }

  function exportar(archivo: ArchivoExport) {
    if (rango === null) return;
    // D-06: el servidor responde con Content-Disposition y el navegador descarga sin salir de la página.
    window.location.assign(reportes.urlExport(archivo, rango));
  }

  const sinFecha = rango === null && sinFranja;

  return (
    <div className={styles.reportes}>
      <div className={styles.encabezado}>
        <h1 className={styles.titulo}>Reportes</h1>
        <div className={styles.periodo}>
          <Segmentado etiqueta="Período" opciones={PERIODOS} valor={periodo} alCambiar={setPeriodo} />
        </div>
        {puede("reporte:exportar") && (
          <div className={styles.exportar}>
            <Menu
              etiqueta="Exportar"
              variante="comun"
              contenido={
                <>
                  <Download strokeWidth={1.75} aria-hidden="true" />
                  <span>Exportar</span>
                </>
              }
              items={[
                { texto: "Tickets (CSV)", alElegir: () => exportar("tickets") },
                { texto: "Historial (CSV)", alElegir: () => exportar("historial") },
              ]}
            />
          </div>
        )}
      </div>

      {fallo || sinFecha ? (
        <div className={styles.bloque}>
          <CloudOff className={styles.iconoBloque} strokeWidth={1.75} aria-hidden="true" />
          <p role="alert" className={styles.textoError}>
            No se pudo cargar el resumen.
          </p>
          <Boton variante="secundario" onClick={reintentar}>
            <RotateCw strokeWidth={1.75} aria-hidden="true" />
            Reintentar
          </Boton>
        </div>
      ) : cargado === null ? (
        <p className={styles.cargando} role="status">
          Cargando…
        </p>
      ) : (
        <Contenido cargado={cargado} pidiendo={pidiendo} />
      )}
    </div>
  );
}

function Contenido({ cargado, pidiendo }: { cargado: Cargado; pidiendo: boolean }) {
  const { resumen, rango } = cargado;
  const dias = completarDias(resumen.por_dia, rango);
  const tarjetas = [
    { nombre: "Pendientes", valor: String(resumen.pendientes), sinDatos: false },
    { nombre: "Críticos activos", valor: String(resumen.criticos_activos), sinDatos: false },
    { nombre: "Total", valor: String(resumen.total), sinDatos: false },
    {
      nombre: "Tiempo medio de resolución",
      valor: textoHoras(resumen.horas_promedio_resolucion),
      sinDatos: resumen.horas_promedio_resolucion === null,
    },
  ];

  return (
    <div className={styles.contenido} aria-busy={pidiendo ? "true" : undefined}>
      <dl className={styles.tarjetas}>
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.nombre} className={styles.tarjeta}>
            <dt className={styles.nombre}>{tarjeta.nombre}</dt>
            <dd className={styles.cifra} data-sin-datos={tarjeta.sinDatos ? "true" : undefined}>
              {tarjeta.valor}
            </dd>
          </div>
        ))}
      </dl>

      {resumen.total === 0 ? (
        <div className={styles.bloque}>
          <Inbox className={styles.iconoBloque} strokeWidth={1.75} aria-hidden="true" />
          <p className={styles.textoVacio}>Sin tickets en el período.</p>
        </div>
      ) : (
        <div className={styles.graficos}>
          <GraficoBarras titulo="Por estado" columna="Estado" datos={serie(resumen.por_estado, ESTADOS, ETIQUETA_ESTADO)} />
          <GraficoBarras
            titulo="Por prioridad"
            columna="Prioridad"
            datos={serie(resumen.por_prioridad, PRIORIDADES, ETIQUETA_PRIORIDAD)}
          />
          <GraficoBarras titulo="Por categoría" columna="Categoría" datos={serie(resumen.por_categoria, CATEGORIAS)} />
          <GraficoBarras
            titulo="Por responsable"
            columna="Responsable"
            datos={serie(resumen.por_responsable, undefined, ETIQUETA_RESPONSABLE)}
          />
          <div className={styles.ancho}>
            <GraficoColumnas
              titulo="Por día"
              columna="Día"
              datos={serie(dias, undefined, etiquetasDeDias(Object.keys(dias)))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
