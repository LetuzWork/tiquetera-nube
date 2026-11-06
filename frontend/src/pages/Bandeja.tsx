import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { tickets } from "../api/endpoints";
import { ESTADOS, PRIORIDADES, type Estado, type Filtros, type Pagina, type Prioridad } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Can } from "../auth/guards";
import { Ponchado } from "../components/Ponchado";
import { Sello } from "../components/Sello";
import { estados, formatoNumero, prioridades } from "../theme/theme";
import { fechaCorta } from "../utils/formato";

const POR_PAGINA = 20;

export function Bandeja() {
  const { me, puede } = useAuth();
  const [texto, setTexto] = useState("");
  const [filtros, setFiltros] = useState<Filtros>({});
  const [soloMios, setSoloMios] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFiltros((f) => ({ ...f, q: texto.trim() }));
      setPagina(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [texto]);

  useEffect(() => {
    let vigente = true;
    const consulta = { ...filtros, responsable: soloMios ? me?.usuario : undefined };
    tickets
      .listar(consulta, pagina, POR_PAGINA)
      .then((d) => vigente && (setDatos(d), setError(null)))
      .catch((e) => vigente && setError(e instanceof ApiError ? e.message : "No se pudo cargar la bandeja."));
    return () => {
      vigente = false;
    };
  }, [filtros, soloMios, pagina, me?.usuario]);

  const cambiar = (parcial: Filtros) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(1);
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1;

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <span className="etiqueta">
            {puede("ticket:ver_todos") ? "Todos los talones" : "Tus talones"} · {datos?.total ?? "…"}
          </span>
          <h1>Bandeja</h1>
        </div>
        <Can permiso="ticket:crear" sino={<span className="etiqueta">Solo lectura</span>}>
          <Link className="tq-boton" to="/tickets/nuevo">
            Sacar número
          </Link>
        </Can>
      </div>

      <div className="filtros" role="search">
        <div className="campo-g filtro-texto">
          <label htmlFor="f-q">Buscar</label>
          <input id="f-q" className="tq-campo" maxLength={100} placeholder="TQ-000012, impresora…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="campo-g">
          <label htmlFor="f-estado">Estado</label>
          <select id="f-estado" className="tq-campo" value={filtros.estado ?? ""} onChange={(e) => cambiar({ estado: e.target.value as Estado | "" })}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {estados[s].etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo-g">
          <label htmlFor="f-prioridad">Prioridad</label>
          <select
            id="f-prioridad"
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
        <Can permiso="ticket:asignar">
          <label className="check">
            <input
              id="f-mios"
              type="checkbox"
              checked={soloMios}
              onChange={(e) => {
                setSoloMios(e.target.checked);
                setPagina(1);
              }}
            />
            Asignados a mí
          </label>
        </Can>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="pila">
        {datos?.items.map((t) => (
          <Link key={t.numero} to={`/tickets/${t.numero}`} className="tq-talon fila-talon">
            <div className="fila-izq">
              <span className="tq-numeradora fila-id">{formatoNumero(t.numero)}</span>
              <Ponchado prioridad={t.prioridad} />
            </div>
            <div className="fila-centro">
              <span className="fila-titulo">{t.titulo}</span>
              <span className="fila-meta tq-numeradora">
                {t.categoria} · {t.solicitante} · {t.responsable ? `→ ${t.responsable}` : "sin responsable"} · {fechaCorta(t.creado_en)}
                {t.comentarios > 0 && ` · ${t.comentarios} coment.`}
              </span>
            </div>
            <Sello estado={t.estado} />
          </Link>
        ))}
        {datos && datos.items.length === 0 && <p className="vacio">No hay talones en esta pila.</p>}
      </div>

      {datos && totalPaginas > 1 && (
        <div className="paginador">
          <button type="button" className="opcion" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span className="tq-numeradora">
            {pagina} / {totalPaginas}
          </span>
          <button type="button" className="opcion" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
