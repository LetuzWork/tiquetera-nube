import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { reportes } from "../api/endpoints";
import { ESTADOS, PRIORIDADES, type Estado, type Filtros, type Prioridad, type Resumen } from "../api/types";
import { Can } from "../auth/guards";
import { Barras } from "../components/Barras";
import { estados, prioridades } from "../theme/theme";

const ETIQUETA_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e, estados[e].etiqueta]));
const ETIQUETA_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((p) => [p, prioridades[p].etiqueta]));

export function Reportes() {
  const [filtros, setFiltros] = useState<Filtros>({});
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    reportes
      .resumen(filtros)
      .then((r) => vigente && (setResumen(r), setError(null)))
      .catch((e) => vigente && setError(e instanceof ApiError ? e.message : "No se pudo cargar el resumen."));
    return () => {
      vigente = false;
    };
  }, [filtros]);

  const cambiar = (parcial: Filtros) => setFiltros((f) => ({ ...f, ...parcial }));

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <span className="etiqueta">Consultas y reportes</span>
          <h1>Reportes</h1>
        </div>
        <Can permiso="reporte:exportar">
          <div className="botonera">
            <a className="tq-boton" href={reportes.urlExport("tickets", filtros)} download>
              Exportar tickets CSV
            </a>
            <a className="tq-boton" data-variante="papel" href={reportes.urlExport("historial", filtros)} download>
              Exportar historial CSV
            </a>
          </div>
        </Can>
      </div>

      <div className="filtros">
        <div className="campo-g">
          <label htmlFor="r-desde">Desde</label>
          <input id="r-desde" type="date" className="tq-campo" value={filtros.desde ?? ""} onChange={(e) => cambiar({ desde: e.target.value })} />
        </div>
        <div className="campo-g">
          <label htmlFor="r-hasta">Hasta</label>
          <input id="r-hasta" type="date" className="tq-campo" value={filtros.hasta ?? ""} onChange={(e) => cambiar({ hasta: e.target.value })} />
        </div>
        <div className="campo-g">
          <label htmlFor="r-estado">Estado</label>
          <select id="r-estado" className="tq-campo" value={filtros.estado ?? ""} onChange={(e) => cambiar({ estado: e.target.value as Estado | "" })}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {estados[s].etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo-g">
          <label htmlFor="r-prioridad">Prioridad</label>
          <select
            id="r-prioridad"
            className="tq-campo"
            value={filtros.prioridad ?? ""}
            onChange={(e) => cambiar({ prioridad: e.target.value as Prioridad | "" })}
          >
            <option value="">Todas</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {prioridades[p].etiqueta}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="opcion" onClick={() => setFiltros({})}>
          Limpiar
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {resumen && (
        <>
          <div className="cifras">
            <div className="cifra">
              <b className="tq-numeradora">{resumen.total}</b>
              <span>talones emitidos</span>
            </div>
            <div className="cifra">
              <b className="tq-numeradora">{resumen.pendientes}</b>
              <span>pendientes</span>
            </div>
            <div className="cifra">
              <b className="tq-numeradora">{resumen.criticos_activos}</b>
              <span>críticos activos</span>
            </div>
            <div className="cifra">
              <b className="tq-numeradora">{resumen.horas_promedio_resolucion ?? "—"}</b>
              <span>horas promedio hasta resolver</span>
            </div>
          </div>
          <div className="reportes-grilla">
            <div className="tq-talon quieto">
              <Barras titulo="Tickets por estado" datos={resumen.por_estado} etiquetas={ETIQUETA_ESTADO} />
            </div>
            <div className="tq-talon quieto">
              <Barras titulo="Tickets por prioridad" datos={resumen.por_prioridad} etiquetas={ETIQUETA_PRIORIDAD} />
            </div>
            <div className="tq-talon quieto">
              <Barras titulo="Tickets por categoría" datos={resumen.por_categoria} />
            </div>
            <div className="tq-talon quieto">
              <Barras titulo="Carga por responsable" datos={resumen.por_responsable} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
