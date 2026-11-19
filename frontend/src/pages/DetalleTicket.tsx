import { ChevronLeft, CloudOff, Lock, SearchX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { tickets } from "../api/endpoints";
import {
  CATEGORIAS,
  ESTADOS,
  PRIORIDADES,
  type Categoria,
  type Estado,
  type Persona,
  type Prioridad,
  type Ticket,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { AreaTexto } from "../components/AreaTexto";
import { Avatar } from "../components/Avatar";
import { useAvisos } from "../components/Avisos";
import { Boton, EnlaceBoton } from "../components/Boton";
import { Confirmacion } from "../components/Confirmacion";
import { EstadoVacio } from "../components/EstadoVacio";
import { GrupoCampos } from "../components/GrupoCampos";
import { IndicadorEstado } from "../components/IndicadorEstado";
import { MarcaPrioridad } from "../components/MarcaPrioridad";
import { Selector, type OpcionSelector } from "../components/Selector";
import { actividad, cuando } from "../detalle/actividad";
import { useResponsables } from "../detalle/useResponsables";
import { useJornada } from "../jornada/JornadaContext";
import { ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD } from "../utils/presentacion";
import { fechaHoraCorta, instanteDe } from "../utils/zona";
import styles from "./DetalleTicket.module.css";

type FallaCarga = "no-existe" | "sin-acceso" | "error";

type Propiedad = "estado" | "responsable" | "prioridad" | "categoria";

interface Pendientes {
  estado?: Estado;
  responsable?: string;
  prioridad?: Prioridad;
  categoria?: Categoria;
}

const LARGO_COMENTARIO = 2000;

const CONFIRMACION: Record<Propiedad, string> = {
  estado: "Estado actualizado",
  responsable: "Responsable actualizado",
  prioridad: "Prioridad actualizada",
  categoria: "Categoría actualizada",
};

const OPCIONES_PRIORIDAD: OpcionSelector<Prioridad>[] = PRIORIDADES.map((p) => ({ valor: p, etiqueta: ETIQUETA_PRIORIDAD[p] }));
const OPCIONES_CATEGORIA: OpcionSelector<Categoria>[] = CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }));

function numeroDeRuta(param: string | undefined): number | null {
  if (param === undefined || !/^\d+$/.test(param)) return null;
  const numero = Number(param);
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : null;
}

function fallaDeCarga(error: unknown): FallaCarga {
  if (!(error instanceof ApiError)) return "error";
  if (error.estado === 404 || error.codigo === "TICKET_NO_ENCONTRADO") return "no-existe";
  if (error.estado === 403 || error.codigo === "PERMISO_DENEGADO") return "sin-acceso";
  return "error";
}

// Un 401 lo atiende la sesión de la 001: su diálogo o el inicio de sesión reemplazan cualquier aviso.
const esCaidaDeSesion = (error: unknown) => error instanceof ApiError && error.estado === 401;

function detalleDelError(error: unknown): string {
  const detalle = error instanceof ApiError ? error.datos.detalle : undefined;
  return typeof detalle === "string" && detalle !== "" ? detalle : "No se pudo aplicar el cambio.";
}

function quitar(pendientes: Pendientes, propiedad: Propiedad): Pendientes {
  const resto = { ...pendientes };
  delete resto[propiedad];
  return resto;
}

function useVolver() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const desdeBandeja = Boolean((ubicacion.state as { desdeBandeja?: unknown } | null)?.desdeBandeja);
  return useCallback(
    (evento: MouseEvent<HTMLAnchorElement>) => {
      // Sin la bandeja detrás, o abriendo en otra pestaña, el enlace sigue a /bandeja como cualquier enlace.
      if (!desdeBandeja || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      evento.preventDefault();
      navegar(-1);
    },
    [desdeBandeja, navegar],
  );
}

export function DetalleTicket() {
  const { numero: param } = useParams();
  const numero = numeroDeRuta(param);
  const volver = useVolver();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [falla, setFalla] = useState<FallaCarga | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setTicket(null);
    if (numero === null) {
      setFalla("no-existe");
      return;
    }
    setFalla(null);
    let vigente = true;
    tickets.obtener(numero).then(
      (recibido) => {
        if (vigente) setTicket(recibido);
      },
      (error: unknown) => {
        if (vigente) setFalla(fallaDeCarga(error));
      },
    );
    return () => {
      vigente = false;
    };
  }, [numero, intento]);

  const actualizar = useCallback((recibido: Ticket) => {
    setTicket((actual) => (actual !== null && actual.numero === recibido.numero ? recibido : actual));
  }, []);

  if (falla === "no-existe" || falla === "sin-acceso") {
    return (
      <EstadoVacio
        icono={falla === "no-existe" ? SearchX : Lock}
        titulo={falla === "no-existe" ? "Este ticket no existe." : "No tenés acceso a este ticket."}
        accion={
          <EnlaceBoton to="/bandeja" variante="primario" onClick={volver}>
            Volver a Tickets
          </EnlaceBoton>
        }
      />
    );
  }

  return (
    <div className={styles.detalle}>
      <Link to="/bandeja" className={styles.volver} onClick={volver}>
        <ChevronLeft className={styles.iconoVolver} strokeWidth={1.75} aria-hidden="true" />
        Tickets
      </Link>
      {falla === "error" ? (
        <EstadoVacio
          icono={CloudOff}
          titulo="No se pudo cargar el ticket."
          accion={
            <Boton variante="primario" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </Boton>
          }
        />
      ) : ticket !== null && ticket.numero === numero ? (
        <Ficha key={ticket.numero} ticket={ticket} alActualizar={actualizar} />
      ) : (
        <p className={styles.cargando} role="status">
          Cargando el ticket…
        </p>
      )}
    </div>
  );
}

interface PropsFicha {
  ticket: Ticket;
  alActualizar: (ticket: Ticket) => void;
}

function Ficha({ ticket, alActualizar }: PropsFicha) {
  const { puede } = useAuth();
  const { zona, jornada } = useJornada();
  const { confirmar, fallar } = useAvisos();
  const responsables = useResponsables();
  const [pendientes, setPendientes] = useState<Pendientes>({});
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const controles = useRef<Partial<Record<Propiedad, HTMLSelectElement | null>>>({});
  const recuperarFoco = useRef<Propiedad | null>(null);
  const textoEstado = useRef<HTMLSpanElement>(null);
  const idDescripcion = useId();
  const idActividad = useId();

  const hoy = jornada?.hoy ?? "";
  const activo = ticket.estado !== "CERRADO";
  const cerrando = pendientes.estado === "CERRADO";

  useEffect(() => {
    // Un control deshabilitado pierde el foco: al terminar de guardar, vuelve a quien lo tenía.
    const propiedad = recuperarFoco.current;
    if (propiedad === null || pendientes[propiedad] !== undefined) return;
    recuperarFoco.current = null;
    const control = controles.current[propiedad];
    if (control?.isConnected && !control.disabled) control.focus();
    else if (propiedad === "estado") textoEstado.current?.focus();
  }, [pendientes]);

  function encolar(pedido: () => Promise<Ticket>): Promise<Ticket> {
    // Un cambio sale cuando respondió el anterior, así ninguna respuesta vieja pisa a una nueva.
    const resultado = cola.current.then(pedido);
    cola.current = resultado.catch(() => undefined);
    return resultado;
  }

  function guardar(propiedad: Propiedad, cambio: Pendientes, pedido: () => Promise<Ticket>) {
    if (document.activeElement === controles.current[propiedad]) recuperarFoco.current = propiedad;
    setPendientes((actuales) => ({ ...actuales, ...cambio }));
    void encolar(pedido).then(
      (recibido) => {
        setPendientes((actuales) => quitar(actuales, propiedad));
        alActualizar(recibido);
        confirmar(CONFIRMACION[propiedad]);
      },
      (error: unknown) => {
        setPendientes((actuales) => quitar(actuales, propiedad));
        if (!esCaidaDeSesion(error)) fallar(detalleDelError(error));
      },
    );
  }

  const nombreDe = (usuario: string) => responsables.find((p) => p.usuario === usuario)?.nombre ?? usuario;
  const referencia = (propiedad: Propiedad) => (control: HTMLSelectElement | null) => {
    controles.current[propiedad] = control;
  };
  const ocupado = (propiedad: Propiedad) => pendientes[propiedad] !== undefined || (cerrando && propiedad !== "estado");

  const puedeEstado = puede("ticket:cambiar_estado") && ticket.acciones.length > 0;
  const puedeAsignar = puede("ticket:asignar") && activo;
  const puedeEditar = puede("ticket:editar") && activo;
  const puedeComentar = puede("ticket:comentar") && activo;

  const opcionesEstado: OpcionSelector<Estado>[] = ESTADOS.filter(
    (e) => e === ticket.estado || ticket.acciones.includes(e),
  ).map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO[e] }));
  const opcionesResponsable: OpcionSelector<string>[] = [
    { valor: "", etiqueta: "Sin asignar" },
    ...conResponsableActual(responsables, ticket.responsable).map((p) => ({ valor: p.usuario, etiqueta: p.nombre })),
  ];

  function elegirEstado(destino: Estado) {
    if (destino === ticket.estado) return;
    if (destino === "CERRADO") {
      setConfirmandoCierre(true);
      return;
    }
    guardar("estado", { estado: destino }, () => tickets.cambiarEstado(ticket.numero, destino));
  }

  function cerrarTicket() {
    setConfirmandoCierre(false);
    guardar("estado", { estado: "CERRADO" }, () => tickets.cambiarEstado(ticket.numero, "CERRADO"));
    recuperarFoco.current = "estado";
  }

  function elegirResponsable(valor: string) {
    if (valor === (ticket.responsable ?? "")) return;
    guardar("responsable", { responsable: valor }, () => tickets.asignar(ticket.numero, valor === "" ? null : valor));
  }

  function elegirPrioridad(valor: Prioridad) {
    if (valor === ticket.prioridad) return;
    guardar("prioridad", { prioridad: valor }, () => tickets.editar(ticket.numero, { prioridad: valor }));
  }

  function elegirCategoria(valor: Categoria) {
    if (valor === ticket.categoria) return;
    guardar("categoria", { categoria: valor }, () => tickets.editar(ticket.numero, { categoria: valor }));
  }

  const publicar = (texto: string) =>
    encolar(() => tickets.comentar(ticket.numero, texto)).then((recibido) => {
      alActualizar(recibido);
    });

  const entradas = actividad(ticket);

  return (
    <div className={styles.ficha}>
      <header className={styles.cabecera}>
        <p className={styles.id}>{ticket.id}</p>
        <h1 className={styles.titulo}>{ticket.titulo}</h1>
        <div className={styles.insignias}>
          <span className={styles.insignia}>
            <IndicadorEstado estado={ticket.estado} />
          </span>
          <span className={styles.insignia}>
            <MarcaPrioridad prioridad={ticket.prioridad} conNombre />
          </span>
        </div>
      </header>

      <div className={styles.propiedades}>
        <GrupoCampos leyenda="Propiedades">
          {puedeEstado ? (
            <Selector
              etiqueta="Estado"
              opciones={opcionesEstado}
              valor={pendientes.estado ?? ticket.estado}
              alCambiar={elegirEstado}
              disabled={ocupado("estado")}
              referencia={referencia("estado")}
            />
          ) : (
            <Dato etiqueta="Estado" referencia={textoEstado}>
              <IndicadorEstado estado={ticket.estado} />
            </Dato>
          )}
          {puedeAsignar ? (
            <Selector
              etiqueta="Responsable"
              opciones={opcionesResponsable}
              valor={pendientes.responsable ?? ticket.responsable ?? ""}
              alCambiar={elegirResponsable}
              disabled={ocupado("responsable")}
              referencia={referencia("responsable")}
            />
          ) : (
            <Dato etiqueta="Responsable">
              {ticket.responsable !== null ? (
                <NombreConAvatar nombre={nombreDe(ticket.responsable)} />
              ) : (
                <span className={styles.sinAsignar}>Sin asignar</span>
              )}
            </Dato>
          )}
          {puedeEditar ? (
            <Selector
              etiqueta="Prioridad"
              opciones={OPCIONES_PRIORIDAD}
              valor={pendientes.prioridad ?? ticket.prioridad}
              alCambiar={elegirPrioridad}
              disabled={ocupado("prioridad")}
              referencia={referencia("prioridad")}
            />
          ) : (
            <Dato etiqueta="Prioridad">{ETIQUETA_PRIORIDAD[ticket.prioridad]}</Dato>
          )}
          {puedeEditar ? (
            <Selector
              etiqueta="Categoría"
              opciones={OPCIONES_CATEGORIA}
              valor={pendientes.categoria ?? ticket.categoria}
              alCambiar={elegirCategoria}
              disabled={ocupado("categoria")}
              referencia={referencia("categoria")}
            />
          ) : (
            <Dato etiqueta="Categoría">{ticket.categoria}</Dato>
          )}
          <Dato etiqueta="Solicitante">
            <NombreConAvatar nombre={nombreDe(ticket.solicitante)} />
          </Dato>
          <Dato etiqueta="Creado">
            <span className={styles.cifras}>{fechaHoraCorta(instanteDe(ticket.creado_en), zona)}</span>
          </Dato>
          <Dato etiqueta="Actualizado">
            <span className={styles.cifras}>{fechaHoraCorta(instanteDe(ticket.actualizado_en), zona)}</span>
          </Dato>
        </GrupoCampos>
      </div>

      <div className={styles.cuerpo}>
        <section className={styles.seccion} aria-labelledby={idDescripcion}>
          <h2 id={idDescripcion} className={styles.subtitulo}>
            Descripción
          </h2>
          <p className={styles.descripcion}>{ticket.descripcion}</p>
        </section>

        <section className={styles.seccion} aria-labelledby={idActividad}>
          <h2 id={idActividad} className={styles.subtitulo}>
            Actividad
          </h2>
          {entradas.length === 0 ? (
            <p className={styles.sinActividad}>Todavía no hay actividad.</p>
          ) : (
            <ol className={styles.actividad}>
              {entradas.map((entrada) =>
                entrada.tipo === "comentario" ? (
                  <li key={entrada.clave} className={styles.entrada} data-tipo="comentario">
                    <Avatar nombre={nombreDe(entrada.autor)} variante="claro" />
                    <div className={styles.comentario}>
                      <p className={styles.firma}>
                        <span className={styles.autor}>{entrada.autor}</span>{" "}
                        <span className={styles.cuando}>{cuando(entrada.instante, zona, hoy)}</span>
                      </p>
                      <p className={styles.burbuja}>{entrada.texto}</p>
                    </div>
                  </li>
                ) : (
                  <li key={entrada.clave} className={styles.entrada} data-tipo="evento">
                    <span className={styles.punto} aria-hidden="true" />
                    <p className={styles.evento}>
                      {entrada.texto} · <span className={styles.cifras}>{cuando(entrada.instante, zona, hoy)}</span>
                    </p>
                  </li>
                ),
              )}
            </ol>
          )}
          {puedeComentar && <Redactor publicar={publicar} bloqueado={cerrando} />}
        </section>
      </div>

      {confirmandoCierre && (
        <Confirmacion
          titulo={`¿Cerrar ${ticket.id}?`}
          texto="Solo un administrador puede reabrirlo."
          textoAceptar="Cerrar ticket"
          varianteAceptar="peligro"
          alAceptar={cerrarTicket}
          alCancelar={() => setConfirmandoCierre(false)}
        />
      )}
    </div>
  );
}

function conResponsableActual(responsables: Persona[], actual: string | null): Persona[] {
  if (actual === null || responsables.some((p) => p.usuario === actual)) return responsables;
  return [...responsables, { usuario: actual, nombre: actual }];
}

interface PropsDato {
  etiqueta: string;
  children: ReactNode;
  referencia?: Ref<HTMLSpanElement>;
}

function Dato({ etiqueta, children, referencia }: PropsDato) {
  return (
    <div className={styles.dato}>
      <span className={styles.etiquetaDato}>{etiqueta}</span>
      <span ref={referencia} tabIndex={referencia === undefined ? undefined : -1} className={styles.valorDato}>
        {children}
      </span>
    </div>
  );
}

function NombreConAvatar({ nombre }: { nombre: string }) {
  return (
    <>
      <Avatar nombre={nombre} variante="claro" />
      <span className={styles.nombre}>{nombre}</span>
    </>
  );
}

interface PropsRedactor {
  publicar: (texto: string) => Promise<void>;
  bloqueado: boolean;
}

function Redactor({ publicar, bloqueado }: PropsRedactor) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  function enviar() {
    if (enviando || bloqueado) return;
    const limpio = texto.trim();
    if (limpio === "") {
      setError("Escribí un comentario.");
      area.current?.focus();
      return;
    }
    setError(null);
    setFalla(false);
    setEnviando(true);
    publicar(limpio).then(
      () => {
        setEnviando(false);
        setTexto("");
      },
      (motivo: unknown) => {
        setEnviando(false);
        if (!esCaidaDeSesion(motivo)) setFalla(true);
      },
    );
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    enviar();
  }

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key !== "Enter" || !(evento.ctrlKey || evento.metaKey)) return;
    evento.preventDefault();
    enviar();
  }

  return (
    <form className={styles.redactor} onSubmit={alEnviar} noValidate>
      <AreaTexto
        ref={area}
        etiqueta="Comentario"
        rows={3}
        maxLength={LARGO_COMENTARIO}
        contador
        value={texto}
        error={error}
        readOnly={enviando}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onChange={(evento) => {
          setTexto(evento.target.value);
          setError(null);
        }}
        onKeyDown={alTeclear}
      />
      <div className={styles.pieRedactor}>
        {falla && (
          <p role="alert" className={styles.falla}>
            No se pudo publicar el comentario.
          </p>
        )}
        <Boton type="submit" variante="primario" cargando={enviando} disabled={bloqueado}>
          Comentar
        </Boton>
      </div>
    </form>
  );
}
