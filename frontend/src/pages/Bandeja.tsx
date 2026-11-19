import { CloudOff, Inbox, Plus, SearchX, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  CATEGORIAS,
  ESTADOS,
  PRIORIDADES,
  type Categoria,
  type Estado,
  type Prioridad,
  type Ticket,
  type TicketResumen,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { RutaProtegida } from "../auth/guards";
import {
  ETIQUETA_ESTADO_FILTRO,
  POR_PAGINA,
  agrupar,
  cantidadFiltros,
  cuandoFila,
  detalleFila,
  filtrosDeVista,
  hayFiltros,
  paramsDeVista,
  textoPie,
  textoResumen,
  ultimaPagina,
  vistaDesdeParams,
  type NombreGrupo,
  type VistaBandeja,
} from "../bandeja/bandeja";
import { useBandeja } from "../bandeja/useBandeja";
import { Avatar } from "../components/Avatar";
import { useAvisos } from "../components/Avisos";
import { Boton, EnlaceBoton } from "../components/Boton";
import { Buscador } from "../components/Buscador";
import { Desplegable } from "../components/Desplegable";
import { DialogoNuevoTicket } from "../components/DialogoNuevoTicket";
import { EstadoVacio } from "../components/EstadoVacio";
import { IndicadorEstado } from "../components/IndicadorEstado";
import { MarcaPrioridad } from "../components/MarcaPrioridad";
import { Segmentado, type OpcionSegmentado } from "../components/Segmentado";
import { Selector, type OpcionSelector } from "../components/Selector";
import { useResponsables } from "../detalle/useResponsables";
import { useJornada } from "../jornada/JornadaContext";
import { useTicketsDeHoy } from "../jornada/useTicketsDeHoy";
import { ETIQUETA_PRIORIDAD } from "../utils/presentacion";
import styles from "./Bandeja.module.css";

type OpcionEstado = Estado | "todos";

const OPCIONES_ESTADO: OpcionSegmentado<OpcionEstado>[] = [
  { valor: "todos", etiqueta: "Todos" },
  ...ESTADOS.map((estado) => ({ valor: estado, etiqueta: ETIQUETA_ESTADO_FILTRO[estado] })),
];

const OPCIONES_PRIORIDAD: OpcionSelector<Prioridad | "">[] = [
  { valor: "", etiqueta: "Todas" },
  ...PRIORIDADES.map((prioridad) => ({ valor: prioridad, etiqueta: ETIQUETA_PRIORIDAD[prioridad] })),
];

const OPCIONES_CATEGORIA: OpcionSelector<Categoria | "">[] = [
  { valor: "", etiqueta: "Todas" },
  ...CATEGORIAS.map((categoria) => ({ valor: categoria, etiqueta: categoria })),
];

interface GrupoVisible {
  nombre: NombreGrupo | null;
  items: TicketResumen[];
}

function desdeBandeja(estado: unknown): boolean {
  return typeof estado === "object" && estado !== null && "desdeBandeja" in estado && estado.desdeBandeja === true;
}

export interface PropsBandeja {
  nuevo?: boolean;
}

export function Bandeja({ nuevo = false }: PropsBandeja) {
  const { me, puede, fin } = useAuth();
  const { jornada, zona } = useJornada();
  const { confirmar } = useAvisos();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const puedeAsignar = puede("ticket:asignar");
  const puedeCrear = puede("ticket:crear");
  const hoy = jornada?.hoy ?? null;
  const pausado = fin !== null;

  const vista = useMemo<VistaBandeja>(() => {
    const leida = vistaDesdeParams(params);
    return puedeAsignar ? leida : { ...leida, mios: false };
  }, [params, puedeAsignar]);

  const { pagina, fallo, cargando, recargar } = useBandeja(filtrosDeVista(vista, me?.usuario ?? ""), vista.pagina, pausado);
  const deHoy = useTicketsDeHoy(hoy, pausado);
  const responsables = useResponsables();
  const nombres = useMemo(() => new Map(responsables.map((persona) => [persona.usuario, persona.nombre])), [responsables]);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const idBase = useId();
  const abierto = nuevo && puedeCrear && !pausado;
  const abiertoAhora = useRef(abierto);
  abiertoAhora.current = abierto;
  const cerrando = useRef(false);

  useEffect(() => {
    if (!abierto) cerrando.current = false;
  }, [abierto]);

  useEffect(() => {
    // El aviso espera a que el diálogo se cierre: con el resto todavía inerte, el lector no lo anunciaría.
    if (creado === null || abierto) return;
    setCreado(null);
    setResaltado(creado);
    confirmar(`Ticket ${creado} creado`);
    recargar();
  }, [creado, abierto, confirmar, recargar]);

  useEffect(() => {
    if (pagina === null || pagina.items.length > 0 || pagina.total === 0 || pagina.pagina !== vista.pagina) return;
    const ultima = ultimaPagina(pagina.total, POR_PAGINA);
    if (vista.pagina > ultima) setParams(paramsDeVista({ ...vista, pagina: ultima }), { replace: true });
  }, [pagina, vista, setParams]);

  function cambiar(cambios: Partial<VistaBandeja>) {
    setParams(paramsDeVista({ ...vista, pagina: 1, ...cambios }), { replace: true });
  }

  function cerrarDialogo() {
    // Volver atrás tarda un evento: un segundo Esc antes de eso retrocedería una página de más.
    if (!abiertoAhora.current || cerrando.current) return;
    cerrando.current = true;
    // Abierto desde la bandeja (botón o navegación), atrás vuelve a esa vista; desde otra sección o la dirección, se reemplaza.
    if (desdeBandeja(ubicacion.state)) navegar(-1);
    else navegar({ pathname: "/bandeja", search: ubicacion.search }, { replace: true });
  }

  function alCrear(ticket: Ticket) {
    setCreado(ticket.id);
    cerrarDialogo();
  }

  function buscar(texto: string) {
    if (texto.trim() === vista.q.trim()) return;
    cambiar({ q: texto });
  }

  const resumen = textoResumen(deHoy.pagina?.items ?? null, deHoy.pagina?.total ?? null);
  const cantidad = cantidadFiltros(vista);
  const items = pagina?.items ?? [];
  const total = pagina?.total ?? 0;
  const ultima = ultimaPagina(total, POR_PAGINA);
  const grupos: GrupoVisible[] = hoy === null ? [{ nombre: null, items }] : agrupar(items, zona, hoy);

  function fila(ticket: TicketResumen) {
    const conResaltado = ticket.id === resaltado;
    const nombre = ticket.responsable === null ? null : (nombres.get(ticket.responsable) ?? ticket.responsable);
    return (
      <li key={ticket.numero} className={styles.item}>
        <Link
          to={`/tickets/${ticket.numero}`}
          state={{ desdeBandeja: true }}
          className={styles.fila}
          data-resaltado={conResaltado ? "true" : undefined}
          onAnimationEnd={conResaltado ? () => setResaltado(null) : undefined}
        >
          <time className={styles.cuando} dateTime={ticket.creado_en}>
            {cuandoFila(ticket.creado_en, zona, hoy ?? "")}
          </time>
          <span className={styles.prioridad}>
            <MarcaPrioridad prioridad={ticket.prioridad} />
          </span>
          <span className={styles.textos}>
            <span className={styles.titular}>{ticket.titulo}</span>
            <span className={styles.detalle}>{detalleFila(ticket)}</span>
          </span>
          <span className={styles.estado}>
            <IndicadorEstado estado={ticket.estado} />
          </span>
          <span className={styles.responsable}>
            {nombre === null ? (
              <span className={styles.sinAsignar}>Sin asignar</span>
            ) : (
              <>
                <Avatar nombre={nombre} variante="claro" />
                <span className={styles.nombre}>{nombre}</span>
              </>
            )}
          </span>
        </Link>
      </li>
    );
  }

  function contenido() {
    if (fallo) {
      return (
        <div role="alert">
          <EstadoVacio
            icono={CloudOff}
            titulo="No se pudo cargar la bandeja."
            nivel={2}
            accion={
              <Boton variante="primario" cargando={cargando} onClick={recargar}>
                Reintentar
              </Boton>
            }
          />
        </div>
      );
    }
    // Sin datos todavía, o con una página fuera de rango que ya se está corrigiendo.
    if (pagina === null || (items.length === 0 && total > 0)) return <div className={styles.esperando} />;
    if (items.length === 0) {
      if (hayFiltros(vista)) {
        return (
          <EstadoVacio
            icono={SearchX}
            titulo="Ningún ticket coincide con los filtros"
            nivel={2}
            accion={
              <Boton variante="primario" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Limpiar filtros
              </Boton>
            }
          />
        );
      }
      return <EstadoVacio icono={Inbox} titulo="No hay tickets" accion={null} nivel={2} />;
    }
    return (
      <>
        <div className={styles.grupos}>
          {grupos.map((grupo) => {
            const idTitulo = `${idBase}-${grupo.nombre ?? "todos"}`;
            return (
              <section
                key={grupo.nombre ?? "todos"}
                className={styles.grupo}
                aria-labelledby={grupo.nombre === null ? undefined : idTitulo}
              >
                {grupo.nombre !== null && (
                  <h2 id={idTitulo} className={styles.grupoTitulo}>
                    <span>{grupo.nombre}</span>
                    <span className={styles.cantidad}>{grupo.items.length}</span>
                  </h2>
                )}
                <ul className={styles.lista}>{grupo.items.map(fila)}</ul>
              </section>
            );
          })}
        </div>
        <div className={styles.pie}>
          <p className={styles.textoPie}>{textoPie(vista.pagina, POR_PAGINA, total)}</p>
          {total > POR_PAGINA && (
            <div className={styles.paginas}>
              <Boton
                variante="secundario"
                disabled={vista.pagina <= 1}
                onClick={() => cambiar({ pagina: vista.pagina - 1 })}
              >
                Anterior
              </Boton>
              <Boton variante="secundario" disabled={vista.pagina >= ultima} onClick={() => cambiar({ pagina: vista.pagina + 1 })}>
                Siguiente
              </Boton>
            </div>
          )}
        </div>
      </>
    );
  }

  // Sin permiso para crear, /tickets/nuevo responde como cualquier otra ruta protegida.
  if (nuevo && !puedeCrear) return <RutaProtegida permiso="ticket:crear">{null}</RutaProtegida>;

  return (
    <div className={styles.bandeja}>
      <div className={styles.encabezado}>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>Tickets</h1>
          <p className={styles.resumen}>{resumen}</p>
        </div>
        <div className={styles.acciones}>
          <div className={styles.busqueda}>
            <Buscador valor={vista.q} alBuscar={buscar} />
          </div>
          {puedeCrear && (
            <EnlaceBoton
              to={{ pathname: "/tickets/nuevo", search: ubicacion.search }}
              state={{ desdeBandeja: true }}
              variante="primario"
            >
              <Plus strokeWidth={1.75} aria-hidden="true" />
              <span>Nuevo ticket</span>
            </EnlaceBoton>
          )}
        </div>
      </div>

      <div className={styles.herramientas}>
        <div className={styles.estados}>
          <Segmentado
            etiqueta="Estado"
            opciones={OPCIONES_ESTADO}
            valor={vista.estado ?? "todos"}
            alCambiar={(valor) => cambiar({ estado: valor === "todos" ? null : valor })}
          />
        </div>
        <div className={styles.menuFiltros}>
          <Desplegable texto={cantidad > 0 ? `Filtros · ${cantidad}` : "Filtros"} icono={SlidersHorizontal}>
            <div className={styles.filtros}>
              <Selector
                etiqueta="Prioridad"
                opciones={OPCIONES_PRIORIDAD}
                valor={vista.prioridad ?? ""}
                alCambiar={(valor) => cambiar({ prioridad: valor === "" ? null : valor })}
              />
              <Selector
                etiqueta="Categoría"
                opciones={OPCIONES_CATEGORIA}
                valor={vista.categoria ?? ""}
                alCambiar={(valor) => cambiar({ categoria: valor === "" ? null : valor })}
              />
              {puedeAsignar && (
                <label className={styles.casilla}>
                  <input type="checkbox" checked={vista.mios} onChange={(evento) => cambiar({ mios: evento.target.checked })} />
                  <span>Solo los asignados a mí</span>
                </label>
              )}
            </div>
          </Desplegable>
        </div>
      </div>

      {contenido()}
      {abierto && <DialogoNuevoTicket alCerrar={cerrarDialogo} alCrear={alCrear} />}
    </div>
  );
}
