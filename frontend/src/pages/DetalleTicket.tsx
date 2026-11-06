import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { tickets, usuarios } from "../api/endpoints";
import { CATEGORIAS, PRIORIDADES, type Categoria, type Estado, type Persona, type Prioridad, type Ticket } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Libreta } from "../components/Libreta";
import { Ponchado } from "../components/Ponchado";
import { Prohibido } from "../components/Prohibido";
import { Sello } from "../components/Sello";
import { prioridades } from "../theme/theme";
import { etiquetaAccion, fechaCorta } from "../utils/formato";

export function DetalleTicket() {
  const { numero: param } = useParams();
  const numero = Number(param);
  const { puede } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [fallo, setFallo] = useState<ApiError | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [responsables, setResponsables] = useState<Persona[]>([]);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!Number.isInteger(numero) || numero < 1) {
      setFallo(new ApiError(404, "TICKET_NO_ENCONTRADO", "El ticket no existe.", {}));
      return;
    }
    tickets
      .obtener(numero)
      .then(setTicket)
      .catch((e) => setFallo(e instanceof ApiError ? e : new ApiError(0, "ERROR", "No se pudo cargar el ticket.", {})));
  }, [numero]);

  useEffect(() => {
    if (puede("ticket:asignar")) usuarios.responsables().then(setResponsables).catch(() => setResponsables([]));
  }, [puede]);

  const ejecutar = useCallback(async (accion: () => Promise<Ticket>) => {
    setOcupado(true);
    setAviso(null);
    try {
      setTicket(await accion());
      return true;
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "No se pudo aplicar el cambio.");
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);

  if (fallo) {
    if (fallo.estado === 403) return <Prohibido detalle={fallo.message} />;
    return (
      <section className="pagina">
        <p className="vacio">{fallo.message}</p>
        <Link to="/bandeja" className="opcion">
          Volver a la bandeja
        </Link>
      </section>
    );
  }
  if (!ticket) return <p className="cargando">Buscando el talón…</p>;

  const activo = ticket.estado !== "CERRADO";
  const puedeComentar = puede("ticket:comentar") && activo;
  const opcionesResponsable = responsables.some((r) => r.usuario === ticket.responsable) || !ticket.responsable
    ? responsables
    : [...responsables, { usuario: ticket.responsable, nombre: ticket.responsable }];

  const enviarComentario = async (e: FormEvent) => {
    e.preventDefault();
    const texto = comentario.trim();
    if (!texto) return;
    if (await ejecutar(() => tickets.comentar(ticket.numero, texto))) setComentario("");
  };

  return (
    <section className="pagina">
      <Link to="/bandeja" className="volver">
        ← Bandeja
      </Link>
      <div className="detalle">
        <article className="tq-talon quieto detalle-talon">
          <div className="detalle-cab">
            <div className="detalle-id">
              <span className="tq-numeradora">{ticket.id}</span>
              <Ponchado prioridad={ticket.prioridad} />
            </div>
            <Sello key={ticket.estado} estado={ticket.estado} />
          </div>
          <h1>{ticket.titulo}</h1>
          <dl className="datos">
            <dt>Categoría</dt>
            <dd>{ticket.categoria}</dd>
            <dt>Prioridad</dt>
            <dd>{prioridades[ticket.prioridad].etiqueta}</dd>
            <dt>Solicitante</dt>
            <dd className="tq-numeradora">{ticket.solicitante}</dd>
            <dt>Responsable</dt>
            <dd className="tq-numeradora">{ticket.responsable ?? "—"}</dd>
            <dt>Creado</dt>
            <dd className="tq-numeradora">{fechaCorta(ticket.creado_en)}</dd>
            <dt>Actualizado</dt>
            <dd className="tq-numeradora">{fechaCorta(ticket.actualizado_en)}</dd>
          </dl>
          <p className="descripcion">{ticket.descripcion}</p>
          <hr className="tq-perforado" />
          <span className="etiqueta">Seguimiento</span>
          {ticket.comentarios.length === 0 && <p className="tenue">Sin comentarios todavía.</p>}
          {ticket.comentarios.map((c, i) => (
            <div className="comentario" key={i}>
              <span className="tq-numeradora comentario-meta">
                {c.autor} · {fechaCorta(c.creado_en)}
              </span>
              <span>{c.texto}</span>
            </div>
          ))}
          {puedeComentar && (
            <form className="comentar" onSubmit={enviarComentario} noValidate>
              <label className="etiqueta" htmlFor="c-texto">
                Agregar comentario
              </label>
              <textarea id="c-texto" className="tq-campo" maxLength={2000} rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
              <div>
                <button className="tq-boton" data-variante="papel" type="submit" disabled={ocupado || !comentario.trim()}>
                  Comentar
                </button>
              </div>
            </form>
          )}
        </article>

        <aside className="acciones">
          {aviso && (
            <p className="error" role="alert">
              {aviso}
            </p>
          )}
          {puede("ticket:cambiar_estado") && (
            <div className="bloque">
              <span className="etiqueta">Cambiar estado</span>
              <div className="botonera">
                {ticket.acciones.length === 0 && <span className="tenue">Archivado. Solo Admin puede reabrirlo.</span>}
                {ticket.acciones.map((destino: Estado) => (
                  <button
                    key={destino}
                    type="button"
                    className="tq-boton"
                    data-variante={destino === "CERRADO" ? "peligro" : destino === "RESUELTO" ? "ok" : undefined}
                    disabled={ocupado}
                    onClick={() => void ejecutar(() => tickets.cambiarEstado(ticket.numero, destino))}
                  >
                    {etiquetaAccion(ticket.estado, destino)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {puede("ticket:asignar") && activo && (
            <div className="bloque">
              <label className="etiqueta" htmlFor="a-responsable">
                Responsable
              </label>
              <select
                id="a-responsable"
                className="tq-campo"
                value={ticket.responsable ?? ""}
                disabled={ocupado}
                onChange={(e) => void ejecutar(() => tickets.asignar(ticket.numero, e.target.value || null))}
              >
                <option value="">— sin asignar —</option>
                {opcionesResponsable.map((p) => (
                  <option key={p.usuario} value={p.usuario}>
                    {p.usuario} · {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {puede("ticket:editar") && activo && (
            <div className="bloque form-fila">
              <div className="campo-g">
                <label className="etiqueta" htmlFor="e-prioridad">
                  Prioridad
                </label>
                <select
                  id="e-prioridad"
                  className="tq-campo"
                  value={ticket.prioridad}
                  disabled={ocupado}
                  onChange={(e) => void ejecutar(() => tickets.editar(ticket.numero, { prioridad: e.target.value as Prioridad }))}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {prioridades[p].etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo-g">
                <label className="etiqueta" htmlFor="e-categoria">
                  Categoría
                </label>
                <select
                  id="e-categoria"
                  className="tq-campo"
                  value={ticket.categoria}
                  disabled={ocupado}
                  onChange={(e) => void ejecutar(() => tickets.editar(ticket.numero, { categoria: e.target.value as Categoria }))}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {!puede("ticket:cambiar_estado") && (
            <div className="bloque">
              <span className="etiqueta">Acciones</span>
              <span className="tenue">
                {puede("ticket:comentar")
                  ? "Podés seguir tu ticket y comentar. El estado lo cambia un operador."
                  : "Rol Consulta: acceso de solo lectura."}
              </span>
            </div>
          )}
          <div className="bloque">
            <span className="etiqueta">Libreta de historial</span>
            <Libreta eventos={ticket.historial} />
          </div>
        </aside>
      </div>
    </section>
  );
}
